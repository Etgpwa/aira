import makeWASocket, { DisconnectReason, useMultiFileAuthState, downloadMediaMessage } from '@whiskeysockets/baileys';
import pino from 'pino';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';
import path from 'path';
import fs from 'fs';
import { detectIntent } from '../ai/intent.detector';
import { userService } from '../user/user.service';
import { transactionService } from '../finance/transaction.service';
import { budgetService } from '../finance/budget.service';
import { debtService } from '../finance/debt.service';
import { receiptService } from '../ocr/receipt.service';
import { queryService } from '../finance/query.service';
import { goalService } from '../finance/goal.service';
import { supabase } from '../supabase/supabase.client';
import { taskService } from '../productivity/task.service';
import { scheduleService } from '../productivity/schedule.service';
import { agendaQueryService } from '../productivity/agenda.query.service';
import { cronService } from '../productivity/cron.service';
import { reminderService } from '../productivity/reminder.service';
import { routineService } from '../routine/routine.service';
import { therapyService } from '../therapy/therapy.service';
import { academicService } from '../academic/academic.service';
import { quizService } from '../academic/quiz.service';
import { askGeminiVision } from '../ai/gemini.client';

/**
 * Mencegah WhatsApp mengubah format angka/titik (misal 1.300.000) menjadi link biru/nomor HP
 */
export const sanitizeWhatsAppText = (text: string): string => {
    if (!text) return text;
    // Sisipkan Zero-Width Space (\u200B) setelah titik yang berada di antara 2 angka
    return text.replace(/(\d)\.(\d)/g, '$1.\u200B$2');
};

export const connectToWhatsApp = async () => {
    // Simpan folder sesi di root workspace agar selalu persisten
    const authDir = path.resolve(process.cwd(), 'auth_info_baileys');
    const { state, saveCreds } = await useMultiFileAuthState(authDir);

    const sock = makeWASocket({
        auth: state,
        logger: require('pino')({ level: 'silent' }),
        browser: ['AsistenPribadi PWA', 'Chrome', '1.0.0'],
    });

    // Inisialisasi cron jobs SETELAH socket open agar connection sudah siap
    let cronInitialized = false;

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('\n📱 Scan QR code di bawah ini menggunakan WhatsApp (nomor khusus bot) 📱\n');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
            const isLoggedOut = statusCode === DisconnectReason.loggedOut || statusCode === 401;

            console.log('Koneksi terputus (Status Code:', statusCode, ')');

            if (isLoggedOut) {
                console.log('🔄 Sesi kadaluarsa/logout detected. Hapus sesi lama & regenerasi QR code baru...');
                if (fs.existsSync(authDir)) {
                    fs.rmSync(authDir, { recursive: true, force: true });
                }
                connectToWhatsApp();
            } else {
                console.log('🔄 Mencoba reconnecting...');
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('\n✅ Sukses! Bot WhatsApp berhasil terhubung!\n');
            // Init cron jobs HANYA saat socket pertama kali open (bukan setiap reconnect)
            if (!cronInitialized) {
                cronInitialized = true;
                cronService.init(sock);
            } else {
                // Update sock reference jika terjadi reconnect
                cronService.updateSock(sock);
            }
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // Message buffer per sender untuk menggabungkan beberapa chat berturut-turut
    const messageBuffers: Map<string, { texts: string[]; timer: NodeJS.Timeout; imageBuffer?: Buffer; mimeType?: string }> = new Map();
    const DEBOUNCE_DELAY_MS = 3500; // Tunggu 3.5 detik jika ada pesan susulan

    interface PendingConfirmation {
        type: 'COMPLETE_SINGLE' | 'COMPLETE_MULTI' | 'PROGRESS_SINGLE' | 'PROGRESS_MULTI';
        taskId?: string;
        taskTitle?: string;
        progressDesc?: string;
        candidates?: Array<{ id: string; title: string; due_date: string | null }>;
        expiresAt: number;
    }

    const pendingConfirmations: Map<string, PendingConfirmation> = new Map();

    function formatDeadline(dueDateStr: string | null | undefined): string {
        if (!dueDateStr) return 'Tidak ada deadline';
        try {
            const d = new Date(dueDateStr);
            return d.toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'Asia/Jakarta'
            });
        } catch {
            return dueDateStr;
        }
    }

    sock.ev.on('messages.upsert', async (m) => {
        if (m.type === 'notify') {
            for (const msg of m.messages) {
                if (!msg.key.fromMe && msg.message) {
                    const from = msg.key.remoteJid;
                    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || '';
                    const isImage = !!msg.message.imageMessage;

                    if ((text || isImage) && from) {
                        // Whitelist filter (support comma-separated numbers & LIDs)
                        const allowedPhoneSetting = process.env.WHATSAPP_PHONE_NUMBER?.trim();
                        const cleanSender = from.split('@')[0].split(':')[0];

                        if (allowedPhoneSetting) {
                            const allowedList = allowedPhoneSetting
                                .split(',')
                                .map(n => n.replace(/[^0-9]/g, '').trim())
                                .filter(Boolean);

                            const isAllowed = allowedList.includes(cleanSender);

                            if (!isAllowed) {
                                console.log(`🔒 Pesan dari ID ${cleanSender} diabaikan (Whitelist yang diizinkan: ${allowedList.join(', ')})`);
                                continue;
                            }
                        }

                        // Beri status "lagi ngetik..." (composing) di WhatsApp
                        await sock.sendPresenceUpdate('composing', from);

                        // Ambil buffer jika ini adalah gambar
                        let imgBuffer: Buffer | undefined;
                        let mimeType: string | undefined;

                        if (isImage) {
                            console.log(`📸 Menerima foto dari ${from}, mengunduh media...`);
                            try {
                                imgBuffer = await downloadMediaMessage(
                                    msg,
                                    'buffer',
                                    {},
                                    {
                                        logger: pino({ level: 'silent' }) as any,
                                        reuploadRequest: sock.updateMediaMessage
                                    }
                                );
                                mimeType = msg.message.imageMessage?.mimetype || 'image/jpeg';
                            } catch (e) {
                                console.error('❌ Gagal download gambar', e);
                            }
                        }

                        // Ambil atau buat buffer baru
                        const existingBuffer = messageBuffers.get(from);

                        if (existingBuffer) {
                            // Reset timer jika ada pesan baru sebelum 3.5 detik
                            clearTimeout(existingBuffer.timer);
                            if (text) existingBuffer.texts.push(text);
                            if (imgBuffer) {
                                existingBuffer.imageBuffer = imgBuffer;
                                existingBuffer.mimeType = mimeType;
                            }
                            console.log(`📩 Pesan susulan diterima dari ${from}: "${text}" (Total: ${existingBuffer.texts.length} pesan)`);
                        } else {
                            messageBuffers.set(from, {
                                texts: text ? [text] : [],
                                imageBuffer: imgBuffer,
                                mimeType,
                                timer: setTimeout(() => { }, 0) // Placeholder
                            });
                        }

                        // Set timer baru untuk memproses pesan setelah 3.5 detik idle
                        const currentBuffer = messageBuffers.get(from)!;
                        currentBuffer.timer = setTimeout(async () => {
                            const combinedText = currentBuffer.texts.join('\n').trim();
                            messageBuffers.delete(from);

                            let finalPromptText = combinedText;

                            // PROSES OCR JIKA ADA GAMBAR
                            if (currentBuffer.imageBuffer) {
                                console.log(`📸 Memulai analisis OCR Gemini Vision untuk ${cleanSender}...`);
                                try {
                                    const classifierPrompt = `Foto ini termasuk kategori apa? Pilih SATU saja dari daftar berikut yang paling akurat: RECEIPT | THERAPY_SCHEDULE | COURSE_SCHEDULE | QUIZ_QUESTIONS | OTHER. Kembalikan HANYA KATA tersebut tanpa penjelasan.`;
                                    
                                    const classifierResponse = await askGeminiVision(
                                        currentBuffer.imageBuffer,
                                        currentBuffer.mimeType || 'image/jpeg',
                                        classifierPrompt
                                    );
                                    const imageType = classifierResponse.trim().toUpperCase();
                                    console.log(`🔍 Klasifikasi gambar: ${imageType}`);
                                    const userId = await userService.getOrCreateUserByPhone(cleanSender);

                                    if (imageType === 'THERAPY_SCHEDULE' || /jadwal|terapi|tsd|okupasi|ot/i.test(combinedText)) {
                                        const scheduleResult = await therapyService.parseScheduleImage(
                                            currentBuffer.imageBuffer,
                                            currentBuffer.mimeType || 'image/jpeg'
                                        );

                                        if (scheduleResult && scheduleResult.items.length > 0) {
                                            const count = await therapyService.saveSchedule(userId, scheduleResult);
                                            const period = scheduleResult.period_label || 'Aktif';
                                            await sock.sendPresenceUpdate('paused', from);
                                            await sock.sendMessage(from, {
                                                text: sanitizeWhatsAppText(`oke, jadwal terapi TSD & OT periode ${period} (${count} sesi) berhasil disimpan dan diperbarui ✓\n\nKamu bisa tanya kapan saja:\n• jadwal terapi hari ini\n• sekarang tsd siapa aja?\n• jadwal okupasi besok`)
                                            });
                                            return;
                                        }
                                    } else if (imageType === 'COURSE_SCHEDULE') {
                                        const count = await academicService.importScheduleFromImage(
                                            userId,
                                            currentBuffer.imageBuffer,
                                            currentBuffer.mimeType || 'image/jpeg'
                                        );
                                        await sock.sendPresenceUpdate('paused', from);
                                        if (count > 0) {
                                            await sock.sendMessage(from, { text: `oke, jadwal kuliah (${count} sesi) berhasil diimpor ✓` });
                                        } else {
                                            await sock.sendMessage(from, { text: 'gagal mendeteksi jadwal kuliah dari foto.' });
                                        }
                                        return;
                                    } else if (imageType === 'QUIZ_QUESTIONS') {
                                        if (!combinedText) {
                                            await sock.sendPresenceUpdate('paused', from);
                                            await sock.sendMessage(from, { text: 'tulis nama matkul di caption foto biar aku tau ini soal buat kuliah apa.' });
                                            return;
                                        }
                                        const count = await quizService.importQuestionsFromImage(
                                            userId,
                                            combinedText,
                                            currentBuffer.imageBuffer,
                                            currentBuffer.mimeType || 'image/jpeg'
                                        );
                                        await sock.sendPresenceUpdate('paused', from);
                                        if (count > 0) {
                                            await sock.sendMessage(from, { text: `oke, ${count} soal dari matkul ${combinedText} berhasil disimpan ke bank soal ✓` });
                                        } else {
                                            await sock.sendMessage(from, { text: 'gagal ekstrak soal dari foto.' });
                                        }
                                        return;
                                    }

                                    // Default fallback ke Struk Belanja (RECEIPT) atau OTHER
                                    const ocrResult = await receiptService.scanReceipt(currentBuffer.imageBuffer, currentBuffer.mimeType || 'image/jpeg');
                                    
                                    if (ocrResult && ocrResult.total_amount > 0) {
                                        if (combinedText) {
                                            finalPromptText = `[SISTEM: User mengunggah gambar struk. Hasil OCR: Total ${ocrResult.total_amount}, Merchant: ${ocrResult.merchant || '-'}, Kategori: ${ocrResult.category || '-'}, Deskripsi: ${ocrResult.description || '-'}. \n\nTAPI, instruksi user di bawah ini adalah SUMBER KEBENARAN UTAMA (Prioritas Tinggi). Catat sesuai teks user jika ada konflik nominal/keterangan dengan OCR.]\n\nInstruksi User: ${combinedText}`;
                                        } else {
                                            const userId = await userService.getOrCreateUserByPhone(cleanSender);
                                            await transactionService.recordTransaction({
                                                userId,
                                                type: 'expense',
                                                amount: ocrResult.total_amount,
                                                currency: ocrResult.currency || 'IDR',
                                                accountName: 'Cash',
                                                categoryName: ocrResult.category || 'Belanja',
                                                description: ocrResult.description || `Struk ${ocrResult.merchant || ''}`
                                            });

                                            let finalReply = ocrResult.reply || `-${ocrResult.total_amount.toLocaleString('id-ID')} ${ocrResult.merchant ? ocrResult.merchant : 'belanja'} dicatat 🧾`;
                                            const budgetWarning = await budgetService.checkBudgetWarning({
                                                userId,
                                                categoryName: ocrResult.category || 'Belanja'
                                            });
                                            if (budgetWarning) finalReply += budgetWarning;

                                            await sock.sendPresenceUpdate('paused', from);
                                            await sock.sendMessage(from, { text: finalReply });
                                            return;
                                        }
                                    } else {
                                        if (!combinedText && imageType !== 'COURSE_SCHEDULE' && imageType !== 'QUIZ_QUESTIONS' && imageType !== 'THERAPY_SCHEDULE') {
                                            await sock.sendPresenceUpdate('paused', from);
                                            await sock.sendMessage(from, { text: 'ga keliatan nominal atau konteksnya, kirim yang lebih jelas atau tambahin teks' });
                                            return;
                                        }
                                    }
                                } catch (ocrErr) {
                                    console.error('❌ Error Media OCR:', ocrErr);
                                    if (!combinedText) {
                                        await sock.sendPresenceUpdate('paused', from);
                                        await sock.sendMessage(from, { text: 'gagal baca foto, coba kirim ulang' });
                                        return;
                                    }
                                }
                            }

                            if (!finalPromptText) return;

                            console.log(`\n💬 Memproses teks dari ${from}:\n"${finalPromptText}"`);
                            const pending = pendingConfirmations.get(cleanSender);

                            // Intersep percakapan jika user sedang dalam sesi konfirmasi tugas
                            if (pending && Date.now() < pending.expiresAt) {
                                const trimmed = combinedText.trim().toLowerCase();

                                // 1. Batal
                                if (/^(batal|cancel|tidak|bukan|ga|nggak|bukan itu)$/i.test(trimmed)) {
                                    pendingConfirmations.delete(cleanSender);
                                    await sock.sendMessage(from, { text: 'oke, dibatalkan.' });
                                    return;
                                }

                                // 2. Konfirmasi Selesai Single ("ya", "iya", "ok", dll)
                                if (pending.type === 'COMPLETE_SINGLE') {
                                    if (/^(ya|iya|betul|benar|ok|oke|yup|yoi|tandai|selesai|1)$/i.test(trimmed)) {
                                        pendingConfirmations.delete(cleanSender);
                                        const userId = await userService.getOrCreateUserByPhone(cleanSender);
                                        await taskService.completeTaskById({ userId, taskId: pending.taskId! });
                                        await sock.sendMessage(from, { text: `oke, tugas *${pending.taskTitle}* selesai ✓` });
                                        return;
                                    }
                                }

                                // 3. Konfirmasi Selesai Multi (Pilihan Angka 1-3)
                                if (pending.type === 'COMPLETE_MULTI') {
                                    const choice = parseInt(trimmed, 10);
                                    if (!isNaN(choice) && pending.candidates && choice >= 1 && choice <= pending.candidates.length) {
                                        pendingConfirmations.delete(cleanSender);
                                        const selected = pending.candidates[choice - 1];
                                        const userId = await userService.getOrCreateUserByPhone(cleanSender);
                                        await taskService.completeTaskById({ userId, taskId: selected.id });
                                        await sock.sendMessage(from, { text: `oke, tugas *${selected.title}* selesai ✓` });
                                        return;
                                    }
                                }

                                // 4. Konfirmasi Progres Single
                                if (pending.type === 'PROGRESS_SINGLE') {
                                    if (/^(ya|iya|betul|benar|ok|oke|yup|yoi|1)$/i.test(trimmed)) {
                                        pendingConfirmations.delete(cleanSender);
                                        const userId = await userService.getOrCreateUserByPhone(cleanSender);
                                        await taskService.updateTaskProgress({
                                            userId,
                                            taskId: pending.taskId!,
                                            progressDescription: pending.progressDesc || 'Sedang dikerjakan',
                                            status: 'IN_PROGRESS'
                                        });
                                        await sock.sendMessage(from, { text: `oke, tugas *${pending.taskTitle}* masuk In Progress (Progres: ${pending.progressDesc})` });
                                        return;
                                    }
                                }

                                // 5. Konfirmasi Progres Multi (Pilihan Angka 1-3)
                                if (pending.type === 'PROGRESS_MULTI') {
                                    const choice = parseInt(trimmed, 10);
                                    if (!isNaN(choice) && pending.candidates && choice >= 1 && choice <= pending.candidates.length) {
                                        pendingConfirmations.delete(cleanSender);
                                        const selected = pending.candidates[choice - 1];
                                        const userId = await userService.getOrCreateUserByPhone(cleanSender);
                                        await taskService.updateTaskProgress({
                                            userId,
                                            taskId: selected.id,
                                            progressDescription: pending.progressDesc || 'Sedang dikerjakan',
                                            status: 'IN_PROGRESS'
                                        });
                                        await sock.sendMessage(from, { text: `oke, tugas *${selected.title}* masuk In Progress (Progres: ${pending.progressDesc})` });
                                        return;
                                    }
                                }
                            }

                            try {
                                const result = await detectIntent(from, combinedText);
                                console.log('🧠 Gemini Intent Result:', JSON.stringify(result, null, 2));


                                let finalReply = result.reply || '';
                                if (!result.intents || !Array.isArray(result.intents)) {
                                    // Fallback if Gemini returns single object by mistake
                                    result.intents = [result as any];
                                }

                                const validIntents = result.intents.filter(i => i.intent && i.intent !== 'UNKNOWN' && i.intent !== 'CHITCHAT');
                                const isSingleIntent = validIntents.length <= 1;

                                for (const singleIntent of result.intents) {
                                    if (!singleIntent.intent || singleIntent.intent === 'UNKNOWN' || singleIntent.intent === 'CHITCHAT') continue;

                                // Integrasi Database: QUERY_FINANCE (Tanya Bebas Saldo & Laporan)
                                if (singleIntent.intent === 'QUERY_FINANCE') {
                                    try {
                                        const cleanSender = from.split('@')[0].split(':')[0];
                                        const userId = await userService.getOrCreateUserByPhone(cleanSender);
                                        const answer = await queryService.answerFinanceQuery(userId, combinedText);
                                        if (isSingleIntent) {
                                            finalReply = answer;
                                        } else {
                                            finalReply = finalReply ? `${finalReply}\n\n${answer}` : answer;
                                        }
                                    } catch (dbErr) {
                                        console.error('❌ Gagal memproses query keuangan:', dbErr);
                                    }
                                }

                                // Integrasi Database: QUERY_AGENDA
                                if (singleIntent.intent === 'QUERY_AGENDA') {
                                    try {
                                        const cleanSender = from.split('@')[0].split(':')[0];
                                        const userId = await userService.getOrCreateUserByPhone(cleanSender);
                                        const answer = await agendaQueryService.answerAgendaQuery(userId, combinedText);
                                        if (isSingleIntent) {
                                            finalReply = answer;
                                        } else {
                                            finalReply = finalReply ? `${finalReply}\n\n${answer}` : answer;
                                        }
                                    } catch (dbErr) {
                                        console.error('❌ Gagal memproses query agenda:', dbErr);
                                        finalReply += "\n" + 'gagal narik data agenda, coba lagi';
                                    }
                                }

                                // Integrasi Database: QUERY_ROUTINE (Tanya Seragam & Medsos Story)
                                if (singleIntent.intent === 'QUERY_ROUTINE') {
                                    try {
                                        const cleanSender = from.split('@')[0].split(':')[0];
                                        const userId = await userService.getOrCreateUserByPhone(cleanSender);
                                        const targetDate = routineService.resolveTargetDate(combinedText);
                                        const ctx = await routineService.calculateDailyContext(userId, targetDate);
                                        let routineMsg = `INFORMASI RUTINITAS KERJA (${ctx.dayName.toUpperCase()})\n`;
                                        if (ctx.isWorkDay) {
                                            routineMsg += `• Seragam: ${ctx.uniform}\n`;
                                            if (ctx.department) {
                                                routineMsg += `• Jadwal Story Instagram: Departemen ${ctx.department}\n`;
                                            }
                                        } else {
                                            routineMsg += `• Hari libur (tidak ada seragam kerja dan story medsos)\n`;
                                        }

                                        if (isSingleIntent) {
                                            finalReply = routineMsg.trim();
                                        } else {
                                            finalReply = finalReply ? `${finalReply}\n\n${routineMsg.trim()}` : routineMsg.trim();
                                        }
                                    } catch (dbErr) {
                                        console.error('❌ Gagal query routine:', dbErr);
                                    }
                                }

                                // Integrasi Database: UPDATE_ROUTINE (Edit Seragam Kerja)
                                if (singleIntent.intent === 'UPDATE_ROUTINE') {
                                    try {
                                        const cleanSender = from.split('@')[0].split(':')[0];
                                        const userId = await userService.getOrCreateUserByPhone(cleanSender);
                                        const parsedUpdates = await routineService.parseUniformUpdateText(combinedText);

                                        if (parsedUpdates) {
                                            await routineService.updateUniforms(userId, parsedUpdates);
                                            const dayNames: Record<string, string> = { '1':'Senin', '2':'Selasa', '3':'Rabu', '4':'Kamis', '5':'Jumat', '6':'Sabtu' };
                                            const summary = Object.entries(parsedUpdates).map(([k, v]) => `${dayNames[k]}: ${v}`).join(', ');
                                            const confirmMsg = `oke, seragam berhasil diupdate: ${summary} ✓`;
                                            if (isSingleIntent) finalReply = confirmMsg;
                                            else finalReply += "\n" + confirmMsg;
                                        } else {
                                            const guide = routineService.getEditUniformGuide();
                                            if (isSingleIntent) finalReply = guide;
                                            else finalReply += "\n" + guide;
                                        }
                                    } catch (dbErr) {
                                        console.error('❌ Gagal update seragam:', dbErr);
                                        finalReply = 'gagal update seragam, coba lagi';
                                    }
                                }

                                // Integrasi Database: QUERY_THERAPY_SCHEDULE (Jadwal Terapi TSD & OT)
                                if (singleIntent.intent === 'QUERY_THERAPY_SCHEDULE') {
                                    try {
                                        const cleanSender = from.split('@')[0].split(':')[0];
                                        const userId = await userService.getOrCreateUserByPhone(cleanSender);
                                        const therapyMsg = await therapyService.answerScheduleQuery(userId, combinedText);

                                        if (isSingleIntent) {
                                            finalReply = therapyMsg;
                                        } else {
                                            finalReply = finalReply ? `${finalReply}\n\n${therapyMsg}` : therapyMsg;
                                        }
                                    } catch (dbErr) {
                                        console.error('❌ Gagal query jadwal terapi:', dbErr);
                                        finalReply = 'gagal mengambil data jadwal terapi, coba lagi';
                                    }
                                }

                                // Integrasi Database: SET_SEMESTER_START
                                if (singleIntent.intent === 'SET_SEMESTER_START' && singleIntent.entities.semester_start_date) {
                                    try {
                                        const cleanSender = from.split('@')[0].split(':')[0];
                                        const userId = await userService.getOrCreateUserByPhone(cleanSender);
                                        await academicService.setSemesterStartDate(userId, singleIntent.entities.semester_start_date);
                                        finalReply = `oke, tanggal mulai semester disimpan ke ${singleIntent.entities.semester_start_date}`;
                                    } catch (err) {
                                        console.error(err);
                                        finalReply = 'gagal menyimpan tanggal mulai semester';
                                    }
                                }

                                // Integrasi Database: QUERY_COURSE_SCHEDULE
                                if (singleIntent.intent === 'QUERY_COURSE_SCHEDULE') {
                                    try {
                                        const cleanSender = from.split('@')[0].split(':')[0];
                                        const userId = await userService.getOrCreateUserByPhone(cleanSender);
                                        
                                        // Cari tahu hari apa dari teks
                                        const txt = combinedText.toLowerCase();
                                        let day = new Date().getDay();
                                        if (txt.includes('besok')) day = (day + 1) % 7;
                                        if (txt.includes('senin')) day = 1;
                                        if (txt.includes('selasa')) day = 2;
                                        if (txt.includes('rabu')) day = 3;
                                        if (txt.includes('kamis')) day = 4;
                                        if (txt.includes('jumat')) day = 5;
                                        if (txt.includes('sabtu')) day = 6;
                                        if (txt.includes('minggu')) day = 0;

                                        const { data } = await supabase.from('course_schedules').select('*').eq('user_id', userId).eq('day_of_week', day).order('start_time', { ascending: true });
                                        
                                        const dayNames = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
                                        let msg = `JADWAL KULIAH (${dayNames[day].toUpperCase()}):\n`;
                                        if (data && data.length > 0) {
                                            data.forEach(s => {
                                                msg += `• ${s.start_time.slice(0,5)}-${s.end_time.slice(0,5)}: ${s.subject_name}`;
                                                if (s.room) msg += ` (R.${s.room})`;
                                                msg += `\n`;
                                            });
                                        } else {
                                            msg += `Libur / Tidak ada jadwal.`;
                                        }

                                        if (isSingleIntent) finalReply = msg.trim();
                                        else finalReply = finalReply ? `${finalReply}\n\n${msg.trim()}` : msg.trim();
                                    } catch (err) {
                                        console.error(err);
                                        finalReply = 'gagal menarik jadwal kuliah';
                                    }
                                }

                                // Integrasi Database: ADD_COURSE_TARGET
                                if (singleIntent.intent === 'ADD_COURSE_TARGET' && singleIntent.entities.subject_name && singleIntent.entities.week_number) {
                                    try {
                                        const cleanSender = from.split('@')[0].split(':')[0];
                                        const userId = await userService.getOrCreateUserByPhone(cleanSender);
                                        const topic = singleIntent.entities.description || `Materi minggu ${singleIntent.entities.week_number}`;
                                        
                                        await academicService.addWeeklyTarget(
                                            userId, 
                                            singleIntent.entities.subject_name, 
                                            singleIntent.entities.week_number,
                                            topic
                                        );
                                        
                                        finalReply = `target minggu ${singleIntent.entities.week_number} matkul ${singleIntent.entities.subject_name} dicatat ✓`;
                                    } catch (err) {
                                        console.error(err);
                                    }
                                }

                                // Integrasi Database: COMPLETE_COURSE_WEEK
                                if (singleIntent.intent === 'COMPLETE_COURSE_WEEK' && singleIntent.entities.subject_name) {
                                    try {
                                        const cleanSender = from.split('@')[0].split(':')[0];
                                        const userId = await userService.getOrCreateUserByPhone(cleanSender);
                                        
                                        await academicService.completeWeeklyTarget(
                                            userId,
                                            singleIntent.entities.subject_name,
                                            singleIntent.entities.week_number || undefined
                                        );

                                        const wkStr = singleIntent.entities.week_number ? `minggu ${singleIntent.entities.week_number}` : 'minggu ini';
                                        finalReply = `oke, materi ${singleIntent.entities.subject_name} ${wkStr} ditandai selesai ✓`;
                                    } catch (err) {
                                        console.error(err);
                                    }
                                }

                                // Integrasi Database: QUERY_COURSE_PROGRESS
                                if (singleIntent.intent === 'QUERY_COURSE_PROGRESS') {
                                    try {
                                        const cleanSender = from.split('@')[0].split(':')[0];
                                        const userId = await userService.getOrCreateUserByPhone(cleanSender);
                                        const progMsg = await academicService.queryProgress(userId);
                                        
                                        if (isSingleIntent) finalReply = progMsg.trim();
                                        else finalReply = finalReply ? `${finalReply}\n\n${progMsg.trim()}` : progMsg.trim();
                                    } catch (err) {
                                        console.error(err);
                                    }
                                }

                                // Integrasi Database: ADD_TASK
                                if (singleIntent.intent === 'ADD_TASK' && (singleIntent.entities.task_name || singleIntent.entities.description)) {
                                    try {
                                        const cleanSender = from.split('@')[0].split(':')[0];
                                        const userId = await userService.getOrCreateUserByPhone(cleanSender);
                                        const taskTitle = singleIntent.entities.task_name || singleIntent.entities.description || 'Tugas Baru';
                                        
                                        // Deteksi prioritas jika ada kata urgent/penting di pesan
                                        const isUrgent = /urgent|penting|darurat|segera/i.test(combinedText);
                                        const priority = isUrgent ? 'HIGH' : 'MEDIUM';

                                        await taskService.addTask({
                                            userId,
                                            title: taskTitle,
                                            dueDate: singleIntent.entities.due_date,
                                            priority
                                        });
                                        console.log(`✅ Berhasil mencatat tugas ${taskTitle} (Priority: ${priority})`);
                                    } catch (dbErr) {
                                        console.error('❌ Gagal mencatat task:', dbErr);
                                        finalReply += "\n" + 'gagal nyimpen tugas, coba lagi';
                                    }
                                }

                                // Integrasi Database: COMPLETE_TASK (Fuzzy Search & Konfirmasi)
                                if (singleIntent.intent === 'COMPLETE_TASK' && (singleIntent.entities.task_name || singleIntent.entities.description)) {
                                    try {
                                        const cleanSender = from.split('@')[0].split(':')[0];
                                        const userId = await userService.getOrCreateUserByPhone(cleanSender);
                                        const targetTitle = singleIntent.entities.task_name || singleIntent.entities.description || '';

                                        const { exactMatch, candidates } = await taskService.findSimilarTasks({
                                            userId,
                                            queryTitle: targetTitle,
                                            statuses: ['TODO', 'IN_PROGRESS']
                                        });

                                        if (exactMatch) {
                                            await taskService.completeTaskById({ userId, taskId: exactMatch.id });
                                            console.log(`✅ Berhasil menyelesaikan tugas exact match: ${exactMatch.title}`);
                                            const confirmMsg = `oke, tugas *${exactMatch.title}* selesai ✓`;
                                            if (isSingleIntent) {
                                                finalReply = confirmMsg;
                                            } else {
                                                finalReply += "\n" + confirmMsg;
                                            }
                                        } else if (candidates.length === 1) {
                                            const task = candidates[0].task;
                                            pendingConfirmations.set(cleanSender, {
                                                type: 'COMPLETE_SINGLE',
                                                taskId: task.id,
                                                taskTitle: task.title,
                                                expiresAt: Date.now() + 5 * 60 * 1000
                                            });
                                            finalReply += "\n" + `Apakah yang ini: "${task.title}"? (Deadline: ${formatDeadline(task.due_date)}). Mau aku tandai sebagai selesai?`;
                                        } else if (candidates.length > 1) {
                                            const top3 = candidates.slice(0, 3);
                                            pendingConfirmations.set(cleanSender, {
                                                type: 'COMPLETE_MULTI',
                                                candidates: top3.map(c => c.task),
                                                expiresAt: Date.now() + 5 * 60 * 1000
                                            });
                                            let msg = 'Ditemukan beberapa tugas yang mirip:\n';
                                            top3.forEach((c, idx) => {
                                                msg += `${idx + 1}. ${c.task.title} (Deadline: ${formatDeadline(c.task.due_date)})\n`;
                                            });
                                            msg += 'Balas dengan angka pilihanmu untuk menandai selesai (atau ketik "batal").';
                                            finalReply += "\n" + msg.trim();
                                        } else {
                                            finalReply += "\n" + `tugas "${targetTitle}" ga ketemu di daftar tugas aktif`;
                                        }
                                    } catch (dbErr) {
                                        console.error('❌ Gagal menyelesaikan task:', dbErr);
                                        finalReply += "\n" + 'gagal update tugas, coba lagi';
                                    }
                                }

                                // Integrasi Database: UPDATE_TASK_PROGRESS (Fuzzy Search & Progress Tracking)
                                if (singleIntent.intent === 'UPDATE_TASK_PROGRESS' && (singleIntent.entities.task_name || singleIntent.entities.description)) {
                                    try {
                                        const cleanSender = from.split('@')[0].split(':')[0];
                                        const userId = await userService.getOrCreateUserByPhone(cleanSender);
                                        const targetTitle = singleIntent.entities.task_name || '';
                                        const progressDesc = singleIntent.entities.description || combinedText;

                                        const { exactMatch, candidates } = await taskService.findSimilarTasks({
                                            userId,
                                            queryTitle: targetTitle || progressDesc,
                                            statuses: ['TODO', 'IN_PROGRESS']
                                        });

                                        if (exactMatch) {
                                            await taskService.updateTaskProgress({
                                                userId,
                                                taskId: exactMatch.id,
                                                progressDescription: progressDesc,
                                                status: 'IN_PROGRESS'
                                            });
                                            console.log(`✅ Berhasil update progres tugas ${exactMatch.title}`);
                                            finalReply += "\n" + `oke, tugas *${exactMatch.title}* masuk In Progress (Progres: ${progressDesc})`;
                                        } else if (candidates.length === 1) {
                                            const task = candidates[0].task;
                                            pendingConfirmations.set(cleanSender, {
                                                type: 'PROGRESS_SINGLE',
                                                taskId: task.id,
                                                taskTitle: task.title,
                                                progressDesc,
                                                expiresAt: Date.now() + 5 * 60 * 1000
                                            });
                                            finalReply += "\n" + `Apakah yang ini: "${task.title}"? (Deadline: ${formatDeadline(task.due_date)}). Mau aku update progresnya ke In Progress: "${progressDesc}"?`;
                                        } else if (candidates.length > 1) {
                                            const top3 = candidates.slice(0, 3);
                                            pendingConfirmations.set(cleanSender, {
                                                type: 'PROGRESS_MULTI',
                                                candidates: top3.map(c => c.task),
                                                progressDesc,
                                                expiresAt: Date.now() + 5 * 60 * 1000
                                            });
                                            let msg = 'Ditemukan beberapa tugas yang mirip:\n';
                                            top3.forEach((c, idx) => {
                                                msg += `${idx + 1}. ${c.task.title} (Deadline: ${formatDeadline(c.task.due_date)})\n`;
                                            });
                                            msg += 'Balas dengan angka pilihanmu untuk update progres (atau ketik "batal").';
                                            finalReply += "\n" + msg.trim();
                                        } else {
                                            finalReply += "\n" + `tugas "${targetTitle || progressDesc}" ga ketemu di daftar tugas aktif`;
                                        }
                                    } catch (dbErr) {
                                        console.error('❌ Gagal update progres task:', dbErr);
                                        finalReply += "\n" + 'gagal update progres tugas, coba lagi';
                                    }
                                }

                                // Integrasi Database: DELETE_TASK
                                if (singleIntent.intent === 'DELETE_TASK' && (singleIntent.entities.task_name || singleIntent.entities.description)) {
                                    try {
                                        const cleanSender = from.split('@')[0].split(':')[0];
                                        const userId = await userService.getOrCreateUserByPhone(cleanSender);
                                        const targetTitle = singleIntent.entities.task_name || singleIntent.entities.description || '';
                                        const deletedTitle = await taskService.deleteTask({
                                            userId,
                                            title: targetTitle
                                        });
                                        if (deletedTitle) {
                                            console.log(`✅ Berhasil menghapus tugas ${deletedTitle}`);
                                            const confirmMsg = `tugas *${deletedTitle}* berhasil dihapus 🗑️`;
                                            if (isSingleIntent) {
                                                finalReply = confirmMsg;
                                            } else {
                                                finalReply += "\n" + confirmMsg;
                                            }
                                        } else {
                                            finalReply += "\n" + `tugas "${targetTitle}" ga ketemu`;
                                        }
                                    } catch (dbErr) {
                                        console.error('❌ Gagal menghapus task:', dbErr);
                                        finalReply += "\n" + 'gagal hapus tugas, coba lagi';
                                    }
                                }

                                // Integrasi Database: ADD_SCHEDULE
                                if (singleIntent.intent === 'ADD_SCHEDULE' && (singleIntent.entities.subject_name || singleIntent.entities.description) && singleIntent.entities.start_time) {
                                    try {
                                        const cleanSender = from.split('@')[0].split(':')[0];
                                        const userId = await userService.getOrCreateUserByPhone(cleanSender);
                                        const subject = singleIntent.entities.subject_name || singleIntent.entities.description || 'Kegiatan Rutin';
                                        
                                        // Default ke hari ini jika day_of_week null/undefined
                                        const currentDay = new Date().getDay();
                                        const dayOfWeek = (singleIntent.entities.day_of_week !== null && singleIntent.entities.day_of_week !== undefined
                                            ? singleIntent.entities.day_of_week
                                            : currentDay) % 7;

                                        await scheduleService.addSchedule({
                                            userId,
                                            subject,
                                            dayOfWeek,
                                            startTime: singleIntent.entities.start_time,
                                            endTime: singleIntent.entities.end_time || singleIntent.entities.start_time
                                        });
                                        console.log(`✅ Berhasil mencatat jadwal rutin ${subject}`);
                                    } catch (dbErr) {
                                        console.error('❌ Gagal mencatat jadwal:', dbErr);
                                        finalReply += "\n" + 'gagal nyimpen jadwal, coba lagi';
                                    }
                                }

                                // Integrasi Database: ADD_REMINDER
                                if (singleIntent.intent === 'ADD_REMINDER' && (singleIntent.entities.description || singleIntent.entities.task_name) && singleIntent.entities.due_date) {
                                    try {
                                        const cleanSender = from.split('@')[0].split(':')[0];
                                        const userId = await userService.getOrCreateUserByPhone(cleanSender);
                                        const message = singleIntent.entities.description || singleIntent.entities.task_name || 'Pengingat';

                                        const res = await reminderService.createReminder({
                                            userId,
                                            message,
                                            remindAt: singleIntent.entities.due_date,
                                            taskTitle: singleIntent.entities.task_name
                                        });

                                        const remindTimeStr = new Date(res.reminder.remind_at).toLocaleTimeString('id-ID', {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                            timeZone: 'Asia/Jakarta'
                                        });

                                        console.log(`✅ Berhasil menyetel custom reminder: ${message} pada ${res.reminder.remind_at}`);
                                        const confirmMsg = res.linkedTaskTitle
                                            ? `oke, pengingat tugas *${res.linkedTaskTitle}* disetel untuk jam ${remindTimeStr} WIB (akan batal otomatis jika tugas sudah selesai) ✓`
                                            : `oke, pengingat *${message}* disetel untuk jam ${remindTimeStr} WIB ✓`;

                                        if (isSingleIntent) {
                                            finalReply = confirmMsg;
                                        } else {
                                            finalReply += "\n" + confirmMsg;
                                        }
                                    } catch (dbErr) {
                                        console.error('❌ Gagal menyetel reminder:', dbErr);
                                        finalReply += "\n" + 'gagal nyetel pengingat, coba lagi';
                                    }
                                }

                                // Integrasi Database: RESCHEDULE_REMINDER
                                if (singleIntent.intent === 'RESCHEDULE_REMINDER' && singleIntent.entities.due_date) {
                                    try {
                                        const cleanSender = from.split('@')[0].split(':')[0];
                                        const userId = await userService.getOrCreateUserByPhone(cleanSender);
                                        const query = singleIntent.entities.description || singleIntent.entities.task_name || '';

                                        const updated = await reminderService.rescheduleReminder({
                                            userId,
                                            query,
                                            newRemindAt: singleIntent.entities.due_date
                                        });

                                        if (updated) {
                                            const newTimeStr = new Date(updated.remind_at).toLocaleTimeString('id-ID', {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                                timeZone: 'Asia/Jakarta'
                                            });
                                            console.log(`✅ Berhasil reschedule reminder ${updated.message} ke ${updated.remind_at}`);
                                            const confirmMsg = `oke, pengingat *${updated.message}* berhasil diundur ke jam ${newTimeStr} WIB ✓`;
                                            if (isSingleIntent) {
                                                finalReply = confirmMsg;
                                            } else {
                                                finalReply += "\n" + confirmMsg;
                                            }
                                        } else {
                                            const notFoundMsg = 'ngga nemu pengingat aktif atau yang baru bunyi (batas reschedule max 15 menit setelah bunyi).';
                                            if (isSingleIntent) {
                                                finalReply = notFoundMsg;
                                            } else {
                                                finalReply += "\n" + notFoundMsg;
                                            }
                                        }
                                    } catch (dbErr) {
                                        console.error('❌ Gagal reschedule reminder:', dbErr);
                                        finalReply += "\n" + 'gagal undur pengingat, coba lagi';
                                    }
                                }

                                // Integrasi Database: DELETE_REMINDER
                                if (singleIntent.intent === 'DELETE_REMINDER') {
                                    try {
                                        const cleanSender = from.split('@')[0].split(':')[0];
                                        const userId = await userService.getOrCreateUserByPhone(cleanSender);
                                        const query = singleIntent.entities.description || singleIntent.entities.task_name || '';

                                        const cancelled = await reminderService.deleteReminder({
                                            userId,
                                            query
                                        });

                                        if (cancelled) {
                                            console.log(`✅ Berhasil membatalkan reminder ${cancelled.message}`);
                                            const confirmMsg = `oke, pengingat *${cancelled.message}* berhasil dibatalkan ✓`;
                                            if (isSingleIntent) {
                                                finalReply = confirmMsg;
                                            } else {
                                                finalReply += "\n" + confirmMsg;
                                            }
                                        } else {
                                            const notFoundMsg = 'ngga nemu pengingat aktif yang cocok buat dibatalkan.';
                                            if (isSingleIntent) {
                                                finalReply = notFoundMsg;
                                            } else {
                                                finalReply += "\n" + notFoundMsg;
                                            }
                                        }
                                    } catch (dbErr) {
                                        console.error('❌ Gagal membatalkan reminder:', dbErr);
                                        finalReply += "\n" + 'gagal batalkan pengingat, coba lagi';
                                    }
                                }

                                // Integrasi Database: UPDATE_LAST_TRANSACTION
                                if (singleIntent.intent === 'UPDATE_LAST_TRANSACTION' && singleIntent.entities.amount) {
                                    try {
                                        const cleanSender = from.split('@')[0].split(':')[0];
                                        const userId = await userService.getOrCreateUserByPhone(cleanSender);
                                        const updateRes = await transactionService.updateLastTransaction(userId, singleIntent.entities.amount);
                                        
                                        if (updateRes) {
                                            console.log(`✅ Berhasil update transaksi terakhir menjadi Rp${singleIntent.entities.amount}`);
                                            const confirmMsg = `oke, transaksi terakhir berhasil direvisi jadi Rp${singleIntent.entities.amount.toLocaleString('id-ID')} ✓`;
                                            if (isSingleIntent) {
                                                finalReply = confirmMsg;
                                            } else {
                                                finalReply += "\n" + confirmMsg;
                                            }
                                        } else {
                                            finalReply += "\n" + 'ngga nemu transaksi baru-baru ini buat diubah (batas 30 menit terakhir).';
                                        }
                                    } catch (dbErr) {
                                        console.error('❌ Gagal update transaksi terakhir:', dbErr);
                                        finalReply += "\n" + 'gagal revisi transaksi, coba lagi';
                                    }
                                }

                                // Integrasi Database: CANCEL_LAST_TRANSACTION
                                if (singleIntent.intent === 'CANCEL_LAST_TRANSACTION') {
                                    try {
                                        const cleanSender = from.split('@')[0].split(':')[0];
                                        const userId = await userService.getOrCreateUserByPhone(cleanSender);
                                        const cancelRes = await transactionService.deleteLastTransaction(userId);
                                        
                                        if (cancelRes) {
                                            console.log(`✅ Berhasil membatalkan transaksi terakhir`);
                                            const confirmMsg = 'oke, transaksi terakhir berhasil dibatalkan & saldo dikembalikan ✓';
                                            if (isSingleIntent) {
                                                finalReply = confirmMsg;
                                            } else {
                                                finalReply += "\n" + confirmMsg;
                                            }
                                        } else {
                                            finalReply += "\n" + 'ngga nemu transaksi baru-baru ini buat dibatalkan (batas 30 menit terakhir).';
                                        }
                                    } catch (dbErr) {
                                        console.error('❌ Gagal membatalkan transaksi terakhir:', dbErr);
                                        finalReply += "\n" + 'gagal batalin transaksi, coba lagi';
                                    }
                                }

                                // Integrasi Database: DELETE_TRANSACTION
                                if (singleIntent.intent === 'DELETE_TRANSACTION') {
                                    try {
                                        const cleanSender = from.split('@')[0].split(':')[0];
                                        const userId = await userService.getOrCreateUserByPhone(cleanSender);
                                        const delRes = await transactionService.deleteMatchingTransaction({
                                            userId,
                                            amount: singleIntent.entities.amount,
                                            description: singleIntent.entities.description || singleIntent.entities.category
                                        });

                                        if (delRes) {
                                            console.log(`✅ Berhasil menghapus transaksi Rp${delRes.amount}`);
                                            const confirmMsg = `oke, transaksi riwayat ${delRes.type === 'expense' ? 'pengeluaran' : 'pemasukan'} Rp${Number(delRes.amount).toLocaleString('id-ID')} berhasil dihapus & saldo dikembalikan ✓`;
                                            if (isSingleIntent) {
                                                finalReply = confirmMsg;
                                            } else {
                                                finalReply += "\n" + confirmMsg;
                                            }
                                        } else {
                                            finalReply += "\n" + 'ngga nemu transaksi pengeluaran/pemasukan yang cocok buat dihapus.';
                                        }
                                    } catch (dbErr) {
                                        console.error('❌ Gagal menghapus transaksi:', dbErr);
                                        finalReply += "\n" + 'gagal hapus transaksi, coba lagi';
                                    }
                                }

                                // Integrasi Database: SET_BALANCE
                                if (singleIntent.intent === 'SET_BALANCE' && (singleIntent.entities.account || singleIntent.entities.description) && singleIntent.entities.amount) {
                                    try {
                                        const cleanSender = from.split('@')[0].split(':')[0];
                                        const userId = await userService.getOrCreateUserByPhone(cleanSender);
                                        const accountName = singleIntent.entities.account || singleIntent.entities.description || 'Cash';

                                        await transactionService.setAccountBalance(userId, accountName, singleIntent.entities.amount);
                                        console.log(`✅ Berhasil set saldo ${accountName} sebesar Rp${singleIntent.entities.amount}`);

                                        const fmtBalance = singleIntent.entities.amount.toLocaleString('id-ID');
                                        finalReply += "\n" + `\n  ${accountName}: Rp ${fmtBalance}`;
                                    } catch (dbErr) {
                                        console.error('❌ Gagal set saldo rekening:', dbErr);
                                    }
                                }

                                // Integrasi Database: SET_BUDGET
                                if (singleIntent.intent === 'SET_BUDGET' && singleIntent.entities.category && singleIntent.entities.amount) {
                                    try {
                                        const cleanSender = from.split('@')[0].split(':')[0];
                                        const userId = await userService.getOrCreateUserByPhone(cleanSender);
                                        await budgetService.setBudget({
                                            userId,
                                            categoryName: singleIntent.entities.category,
                                            amount: singleIntent.entities.amount
                                        });
                                        console.log(`✅ Berhasil set budget ${singleIntent.entities.category} Rp${singleIntent.entities.amount}`);
                                    } catch (dbErr) {
                                        console.error('❌ Gagal set budget:', dbErr);
                                        finalReply += "\n" + 'Maaf bos, gagal menyimpan budget ke database.';
                                    }
                                }

                                // Integrasi Database: ADD_DEBT & ADD_RECEIVABLE
                                if (['ADD_DEBT', 'ADD_RECEIVABLE'].includes(singleIntent.intent) && singleIntent.entities.person_name && singleIntent.entities.amount) {
                                    try {
                                        const cleanSender = from.split('@')[0].split(':')[0];
                                        const userId = await userService.getOrCreateUserByPhone(cleanSender);
                                        const debtType = singleIntent.intent === 'ADD_DEBT' ? 'PAYABLE' : 'RECEIVABLE';

                                        await debtService.recordDebt({
                                            userId,
                                            personName: singleIntent.entities.person_name,
                                            type: debtType,
                                            amount: singleIntent.entities.amount,
                                            currency: singleIntent.entities.currency || 'IDR',
                                            description: singleIntent.entities.description
                                        });
                                        console.log(`✅ Berhasil mencatat ${debtType} atas nama ${singleIntent.entities.person_name} sebesar Rp${singleIntent.entities.amount}`);

                                        // Update saldo rekening & catat transaksi
                                        const accountName = singleIntent.entities.account || 'Cash';
                                        const txType = debtType === 'RECEIVABLE' ? 'expense' : 'income';
                                        const txCategory = debtType === 'RECEIVABLE' ? 'Pemberian Piutang' : 'Penerimaan Pinjaman';
                                        const txDesc = debtType === 'RECEIVABLE'
                                            ? `Pinjaman ke ${singleIntent.entities.person_name}${singleIntent.entities.description ? ' (' + singleIntent.entities.description + ')' : ''}`
                                            : `Pinjaman dari ${singleIntent.entities.person_name}${singleIntent.entities.description ? ' (' + singleIntent.entities.description + ')' : ''}`;

                                        const txResult = await transactionService.recordTransaction({
                                            userId,
                                            type: txType,
                                            amount: singleIntent.entities.amount,
                                            currency: singleIntent.entities.currency || 'IDR',
                                            accountName: accountName,
                                            categoryName: txCategory,
                                            description: txDesc
                                        });

                                        // Tampilkan total hutang/piutang aktif ke orang ini
                                        const { data: existingDebts } = await supabase
                                            .from('debts')
                                            .select('remaining_amount, description, created_at')
                                            .eq('user_id', userId)
                                            .ilike('person_name', singleIntent.entities.person_name)
                                            .in('status', ['UNPAID', 'PARTIAL']);

                                        if (existingDebts && existingDebts.length > 0) {
                                            const totalRemaining = existingDebts.reduce((sum: number, d: any) => sum + Number(d.remaining_amount || 0), 0);
                                            const label = debtType === 'PAYABLE' ? 'Hutangku ke' : 'Piutang dari';
                                            finalReply += "\n" + `\n\n📋 *${label} ${singleIntent.entities.person_name}*: Rp ${totalRemaining.toLocaleString('id-ID')} total`;
                                            if (existingDebts.length > 1) {
                                                for (const d of existingDebts) {
                                                    finalReply += "\n" + `\n  • Rp ${Number(d.remaining_amount).toLocaleString('id-ID')}${d.description ? ' (' + d.description + ')' : ''}`;
                                                }
                                            }
                                        }

                                        const fmtBalance = txResult.newBalance.toLocaleString('id-ID');
                                        finalReply += "\n" + `\n  saldo ${accountName}: Rp ${fmtBalance}`;
                                    } catch (dbErr) {
                                        console.error('❌ Gagal mencatat hutang/piutang:', dbErr);
                                        finalReply += "\n" + 'gagal nyimpen, coba lagi';
                                    }
                                }

                                // Integrasi Database: DELETE_DEBT
                                if (singleIntent.intent === 'DELETE_DEBT' && singleIntent.entities.person_name) {
                                    try {
                                        const cleanSender = from.split('@')[0].split(':')[0];
                                        const userId = await userService.getOrCreateUserByPhone(cleanSender);

                                        const delRes = await debtService.deleteDebt({
                                            userId,
                                            personName: singleIntent.entities.person_name
                                        });

                                        if (delRes) {
                                            console.log(`✅ Berhasil menghapus hutang/piutang ${delRes.person_name} sejumlah Rp${delRes.amount}`);

                                            // Revert transaksi saldo rekening
                                            const accountName = singleIntent.entities.account || 'Cash';
                                            const revertTxType = delRes.type === 'RECEIVABLE' ? 'income' : 'expense';
                                            const revertCategory = delRes.type === 'RECEIVABLE' ? 'Pembatalan Piutang' : 'Pembatalan Hutang';

                                            const txResult = await transactionService.recordTransaction({
                                                userId,
                                                type: revertTxType,
                                                amount: Number(delRes.amount),
                                                currency: delRes.currency || 'IDR',
                                                accountName: accountName,
                                                categoryName: revertCategory,
                                                description: `Pembatalan ${delRes.type === 'RECEIVABLE' ? 'Piutang' : 'Hutang'} ${delRes.person_name}`
                                            });

                                            const label = delRes.type === 'PAYABLE' ? 'Hutangku ke' : 'Piutang dari';
                                            const confirmMsg = `oke, catatan ${label} ${delRes.person_name} (Rp ${Number(delRes.amount).toLocaleString('id-ID')}) berhasil dihapus/dibatalkan & saldo ${accountName} disesuaikan (Rp ${txResult.newBalance.toLocaleString('id-ID')}) ✓`;
                                            if (isSingleIntent) {
                                                finalReply = confirmMsg;
                                            } else {
                                                finalReply += "\n" + confirmMsg;
                                            }
                                        } else {
                                            finalReply += "\n" + `ngga nemu catatan hutang/piutang aktif atas nama ${singleIntent.entities.person_name} buat dibatalkan.`;
                                        }
                                    } catch (dbErr) {
                                        console.error('❌ Gagal menghapus hutang/piutang:', dbErr);
                                        finalReply += "\n" + 'gagal menghapus catatan hutang/piutang, coba lagi';
                                    }
                                }

                                // Integrasi Database: PAY_DEBT
                                if (singleIntent.intent === 'PAY_DEBT' && singleIntent.entities.person_name && singleIntent.entities.amount) {
                                    try {
                                        const cleanSender = from.split('@')[0].split(':')[0];
                                        const userId = await userService.getOrCreateUserByPhone(cleanSender);

                                        const payResult = await debtService.payDebt({
                                            userId,
                                            personName: singleIntent.entities.person_name,
                                            amount: singleIntent.entities.amount
                                        });

                                        if (payResult) {
                                            console.log(`✅ Berhasil mencatat pelunasan ${payResult.personName} Rp${payResult.paidAmount}`);
                                            
                                            // UPDATE SALDO / CASH
                                            const accountName = singleIntent.entities.account || 'Cash';
                                            const txType = payResult.debtType === 'PAYABLE' ? 'expense' : 'income';
                                            const txCategory = payResult.debtType === 'PAYABLE' ? 'Pelunasan Hutang' : 'Penerimaan Piutang';
                                            
                                            await transactionService.recordTransaction({
                                                userId,
                                                type: txType,
                                                amount: payResult.paidAmount,
                                                currency: 'IDR',
                                                accountName: accountName,
                                                categoryName: txCategory,
                                                description: `${txCategory} ${payResult.personName}`
                                            });

                                            const paidFmt = payResult.paidAmount.toLocaleString('id-ID');
                                            const remainFmt = payResult.remainingAmount.toLocaleString('id-ID');
                                            const label = payResult.debtType === 'PAYABLE' ? 'Hutangku ke' : 'Piutang dari';

                                            if (payResult.status === 'PAID') {
                                                finalReply += "\n" + `\n\n📋 *${label} ${payResult.personName}* LUNAS ✓`;
                                            } else {
                                                finalReply += "\n" + `\n\n📋 *${label} ${payResult.personName}*\n  Bayar: Rp ${paidFmt}\n  Sisa: Rp ${remainFmt}`;
                                            }
                                        } else {
                                            finalReply += "\n" + `\n\n(tidak ditemukan catatan hutang atas nama ${singleIntent.entities.person_name})`;
                                        }
                                    } catch (dbErr) {
                                        console.error('❌ Gagal mencatat pelunasan:', dbErr);
                                        finalReply += "\n" + 'gagal nyimpen, coba lagi';
                                    }
                                }
                                // Integrasi Database: CREATE_GOAL
                                if (singleIntent.intent === 'CREATE_GOAL' && (singleIntent.entities.goal_name || singleIntent.entities.description) && singleIntent.entities.amount) {
                                    try {
                                        const cleanSender = from.split('@')[0].split(':')[0];
                                        const userId = await userService.getOrCreateUserByPhone(cleanSender);
                                        const goalName = singleIntent.entities.goal_name || singleIntent.entities.description || 'Target Baru';

                                        await goalService.createGoal({
                                            userId,
                                            name: goalName,
                                            targetAmount: singleIntent.entities.amount || 0,
                                            targetDate: singleIntent.entities.due_date,
                                            currency: singleIntent.entities.currency || 'IDR'
                                        });
                                        console.log(`✅ Berhasil membuat goal "${goalName}" target Rp${singleIntent.entities.amount}`);
                                    } catch (dbErr) {
                                        console.error('❌ Gagal membuat goal:', dbErr);
                                    }
                                }

                                // Integrasi Database: DELETE_GOAL
                                if (singleIntent.intent === 'DELETE_GOAL' && (singleIntent.entities.goal_name || singleIntent.entities.description)) {
                                    try {
                                        const cleanSender = from.split('@')[0].split(':')[0];
                                        const userId = await userService.getOrCreateUserByPhone(cleanSender);
                                        const goalName = singleIntent.entities.goal_name || singleIntent.entities.description || '';

                                        const deletedName = await goalService.deleteGoal(userId, goalName);
                                        if (deletedName) {
                                            console.log(`✅ Berhasil menghapus goal "${deletedName}"`);
                                            finalReply += "\n" + `target tabungan *${deletedName}* berhasil dihapus 🗑️`;
                                        } else {
                                            finalReply += "\n" + `target tabungan "${goalName}" ga ketemu`;
                                        }
                                    } catch (dbErr) {
                                        console.error('❌ Gagal menghapus goal:', dbErr);
                                        finalReply += "\n" + 'gagal hapus tabungan, coba lagi';
                                    }
                                }

                                // Integrasi Database: TOPUP_GOAL
                                if (singleIntent.intent === 'TOPUP_GOAL' && (singleIntent.entities.goal_name || singleIntent.entities.description) && singleIntent.entities.amount) {
                                    try {
                                        const cleanSender = from.split('@')[0].split(':')[0];
                                        const userId = await userService.getOrCreateUserByPhone(cleanSender);
                                        const goalName = singleIntent.entities.goal_name || singleIntent.entities.description || '';

                                        const topupRes = await goalService.topupGoal({
                                            userId,
                                            goalName,
                                            amount: singleIntent.entities.amount
                                        });

                                        if (topupRes) {
                                            console.log(`✅ Berhasil topup goal "${topupRes.goalName}" Rp${topupRes.addedAmount}`);

                                            // Baris konfirmasi singkat dari Gemini tetap dipakai
                                            // Tambahkan rincian keuangan di bawahnya

                                            // --- Blok: Progres semua goal aktif ---
                                            let goalLines = '';
                                            for (const g of topupRes.allGoals) {
                                                const cur = g.currentAmount.toLocaleString('id-ID');
                                                const tar = g.targetAmount.toLocaleString('id-ID');
                                                const star = g.name === topupRes.goalName ? '▶ ' : '  ';
                                                goalLines += `${star}${g.name}: ${cur}/${tar} (${g.percentage}%)\n`;
                                            }

                                            // --- Blok: Saldo per rekening ---
                                            let accountLines = '';
                                            for (const acc of topupRes.accounts) {
                                                if (acc.balance !== 0) {
                                                    accountLines += `  ${acc.name}: Rp ${acc.balance.toLocaleString('id-ID')}\n`;
                                                }
                                            }

                                            const freeStr = topupRes.freeBalance.toLocaleString('id-ID');
                                            const allocStr = topupRes.totalAllocatedGoals.toLocaleString('id-ID');

                                            finalReply += "\n" +
                                                `\n\n🎯 *Tabungan aktif:*\n${goalLines}` +
                                                `\n💳 *Rekening:*\n${accountLines}` +
                                                `  Teralokasi ke goal: Rp ${allocStr}\n` +
                                                `  *Saldo bebas: Rp ${freeStr}*` +
                                                (topupRes.status === 'ACHIEVED' ? '\n\n🎉 target tercapai!' : '');
                                        }
                                    } catch (dbErr) {
                                        console.error('❌ Gagal topup goal:', dbErr);
                                    }
                                }

                                // Integrasi Database: ADD_EXPENSE / ADD_INCOME
                                if (['ADD_EXPENSE', 'ADD_INCOME'].includes(singleIntent.intent) && singleIntent.entities.amount) {
                                    try {
                                        // 1. Dapatkan atau buat userId berdasarkan nomor WhatsApp
                                        const cleanSender = from.split('@')[0].split(':')[0];
                                        const userId = await userService.getOrCreateUserByPhone(cleanSender);

                                        // 2. Simpan transaksi
                                        const txType = singleIntent.intent === 'ADD_EXPENSE' ? 'expense' : 'income';
                                        const txResult = await transactionService.recordTransaction({
                                            userId,
                                            type: txType,
                                            amount: singleIntent.entities.amount,
                                            currency: singleIntent.entities.currency || 'IDR',
                                            accountName: singleIntent.entities.account,
                                            categoryName: singleIntent.entities.category,
                                            description: singleIntent.entities.description
                                        });

                                        console.log(`✅ Berhasil mencatat ${txType} ke database`);

                                        // Tampilkan saldo rekening setelah transaksi
                                        const accName = singleIntent.entities.account || 'Cash';
                                        const fmtBalance = txResult.newBalance.toLocaleString('id-ID');
                                        finalReply += "\n" + `\n  saldo ${accName}: Rp ${fmtBalance}`;

                                        // Jika ada konversi mata uang (misal USD -> IDR), tambahkan info konversi ke balasan Karen
                                        if (txResult.converted) {
                                            const formattedFinal = txResult.finalAmount.toLocaleString('id-ID');
                                            finalReply += "\n" + `\n💱 ${txResult.originalAmount} ${txResult.originalCurrency} ≈ Rp ${formattedFinal}`;
                                        }

                                        // Cek peringatan budget (Auto-Warning) jika transaksi adalah pengeluaran
                                        if (txType === 'expense' && singleIntent.entities.category) {
                                            const budgetWarning = await budgetService.checkBudgetWarning({
                                                userId,
                                                categoryName: singleIntent.entities.category
                                            });
                                            if (budgetWarning) {
                                                finalReply += "\n" + budgetWarning;
                                            }
                                        }
                                    } catch (dbErr) {
                                        console.error('❌ Gagal mencatat ke database:', dbErr);
                                        finalReply += "\n" + 'gagal nyimpen, coba lagi';
                                    }
                                }


                                }
                                
                                // Clean up finalReply
                                finalReply = finalReply.trim();

                                // Hentikan status "ngetik"
                                await sock.sendPresenceUpdate('paused', from);

                                // Balas pesan ke user
                                await sock.sendMessage(from, { text: sanitizeWhatsAppText(finalReply) });
                            } catch (err) {
                                console.error('Error proses pesan:', err);
                                await sock.sendPresenceUpdate('paused', from);
                            }
                        }, DEBOUNCE_DELAY_MS);
                    }
                }
            }
        }
    });

    return sock;
};

