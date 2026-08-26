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
    const messageBuffers: Map<string, { texts: string[]; timer: NodeJS.Timeout }> = new Map();
    const DEBOUNCE_DELAY_MS = 3500; // Tunggu 3.5 detik jika ada pesan susulan

    sock.ev.on('messages.upsert', async (m) => {
        if (m.type === 'notify') {
            for (const msg of m.messages) {
                if (!msg.key.fromMe && msg.message) {
                    const from = msg.key.remoteJid;
                    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
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

                        // PERLAKUAN KHUSUS APABILA PESAN ADALAH GAMBAR / FOTO STRUK
                        if (isImage) {
                            console.log(`📸 Menerima foto dari ${from}, memulai analisis OCR Gemini Vision...`);
                            try {
                                const buffer = await downloadMediaMessage(
                                    msg,
                                    'buffer',
                                    {},
                                    {
                                        logger: pino({ level: 'silent' }) as any,
                                        reuploadRequest: sock.updateMediaMessage
                                    }
                                );

                                const mimeType = msg.message.imageMessage?.mimetype || 'image/jpeg';
                                const ocrResult = await receiptService.scanReceipt(buffer, mimeType);

                                if (ocrResult && ocrResult.total_amount > 0) {
                                    const userId = await userService.getOrCreateUserByPhone(cleanSender);

                                    // Catat transaksi pengeluaran dari hasil OCR
                                    await transactionService.recordTransaction({
                                        userId,
                                        type: 'expense',
                                        amount: ocrResult.total_amount,
                                        currency: ocrResult.currency || 'IDR',
                                        accountName: 'Cash', // Default ke Cash jika tak sebut
                                        categoryName: ocrResult.category || 'Belanja',
                                        description: ocrResult.description || `Struk ${ocrResult.merchant || ''}`
                                    });

                                    let finalReply = ocrResult.reply || `-${ocrResult.total_amount.toLocaleString('id-ID')} ${ocrResult.merchant ? ocrResult.merchant : 'belanja'} dicatat 🧾`;

                                    // Cek warning budget jika ada
                                    const budgetWarning = await budgetService.checkBudgetWarning({
                                        userId,
                                        categoryName: ocrResult.category || 'Belanja'
                                    });
                                    if (budgetWarning) {
                                        finalReply += budgetWarning;
                                    }

                                    await sock.sendPresenceUpdate('paused', from);
                                    await sock.sendMessage(from, { text: finalReply });
                                } else {
                                    await sock.sendPresenceUpdate('paused', from);
                                    await sock.sendMessage(from, { text: 'ga keliatan totalnya, kirim yang lebih jelas atau ketik aja' });
                                }
                            } catch (ocrErr) {
                                console.error('❌ Error OCR Struk:', ocrErr);
                                await sock.sendPresenceUpdate('paused', from);
                                await sock.sendMessage(from, { text: 'gagal baca struk, coba kirim ulang' });
                            }
                            continue;
                        }

                        // Ambil atau buat buffer baru
                        const existingBuffer = messageBuffers.get(from);

                        if (existingBuffer) {
                            // Reset timer jika ada pesan baru sebelum 3.5 detik
                            clearTimeout(existingBuffer.timer);
                            existingBuffer.texts.push(text);
                            console.log(`📩 Pesan susulan diterima dari ${from}: "${text}" (Total: ${existingBuffer.texts.length} pesan)`);
                        } else {
                            messageBuffers.set(from, {
                                texts: [text],
                                timer: setTimeout(() => { }, 0) // Placeholder
                            });
                        }

                        // Set timer baru untuk memproses pesan setelah 3.5 detik idle
                        const currentBuffer = messageBuffers.get(from)!;
                        currentBuffer.timer = setTimeout(async () => {
                            const combinedText = currentBuffer.texts.join('\n');
                            messageBuffers.delete(from);

                            console.log(`\n💬 Memproses total ${currentBuffer.texts.length} pesan dari ${from}:\n"${combinedText}"`);

                            try {
                                const result = await detectIntent(from, combinedText);
                                console.log('🧠 Gemini Intent Result:', JSON.stringify(result, null, 2));

                                // Integrasi Database: QUERY_FINANCE (Tanya Bebas Saldo & Laporan)
                                if (result.intent === 'QUERY_FINANCE') {
                                    try {
                                        const cleanSender = from.split('@')[0].split(':')[0];
                                        const userId = await userService.getOrCreateUserByPhone(cleanSender);
                                        const answer = await queryService.answerFinanceQuery(userId, combinedText);
                                        result.reply = answer;
                                    } catch (dbErr) {
                                        console.error('❌ Gagal memproses query keuangan:', dbErr);
                                    }
                                }

                                // Integrasi Database: QUERY_AGENDA
                                if (result.intent === 'QUERY_AGENDA') {
                                    try {
                                        const cleanSender = from.split('@')[0].split(':')[0];
                                        const userId = await userService.getOrCreateUserByPhone(cleanSender);
                                        const answer = await agendaQueryService.answerAgendaQuery(userId, combinedText);
                                        result.reply = answer;
                                    } catch (dbErr) {
                                        console.error('❌ Gagal memproses query agenda:', dbErr);
                                        result.reply = 'gagal narik data agenda, coba lagi';
                                    }
                                }

                                // Integrasi Database: ADD_TASK
                                if (result.intent === 'ADD_TASK' && (result.entities.task_name || result.entities.description)) {
                                    try {
                                        const cleanSender = from.split('@')[0].split(':')[0];
                                        const userId = await userService.getOrCreateUserByPhone(cleanSender);
                                        const taskTitle = result.entities.task_name || result.entities.description || 'Tugas Baru';
                                        
                                        // Deteksi prioritas jika ada kata urgent/penting di pesan
                                        const isUrgent = /urgent|penting|darurat|segera/i.test(combinedText);
                                        const priority = isUrgent ? 'HIGH' : 'MEDIUM';

                                        await taskService.addTask({
                                            userId,
                                            title: taskTitle,
                                            dueDate: result.entities.due_date,
                                            priority
                                        });
                                        console.log(`✅ Berhasil mencatat tugas ${taskTitle} (Priority: ${priority})`);
                                    } catch (dbErr) {
                                        console.error('❌ Gagal mencatat task:', dbErr);
                                        result.reply = 'gagal nyimpen tugas, coba lagi';
                                    }
                                }

                                // Integrasi Database: COMPLETE_TASK
                                if (result.intent === 'COMPLETE_TASK' && (result.entities.task_name || result.entities.description)) {
                                    try {
                                        const cleanSender = from.split('@')[0].split(':')[0];
                                        const userId = await userService.getOrCreateUserByPhone(cleanSender);
                                        const targetTitle = result.entities.task_name || result.entities.description || '';
                                        const doneTask = await taskService.completeTask({
                                            userId,
                                            title: targetTitle
                                        });
                                        if (doneTask) {
                                            console.log(`✅ Berhasil menyelesaikan tugas ${doneTask.title}`);
                                            result.reply = `oke, tugas *${doneTask.title}* selesai ✓`;
                                        } else {
                                            result.reply = `tugas "${targetTitle}" ga ketemu atau udah kelar`;
                                        }
                                    } catch (dbErr) {
                                        console.error('❌ Gagal menyelesaikan task:', dbErr);
                                        result.reply = 'gagal update tugas, coba lagi';
                                    }
                                }

                                // Integrasi Database: DELETE_TASK
                                if (result.intent === 'DELETE_TASK' && (result.entities.task_name || result.entities.description)) {
                                    try {
                                        const cleanSender = from.split('@')[0].split(':')[0];
                                        const userId = await userService.getOrCreateUserByPhone(cleanSender);
                                        const targetTitle = result.entities.task_name || result.entities.description || '';
                                        const deletedTitle = await taskService.deleteTask({
                                            userId,
                                            title: targetTitle
                                        });
                                        if (deletedTitle) {
                                            console.log(`✅ Berhasil menghapus tugas ${deletedTitle}`);
                                            result.reply = `tugas *${deletedTitle}* berhasil dihapus 🗑️`;
                                        } else {
                                            result.reply = `tugas "${targetTitle}" ga ketemu`;
                                        }
                                    } catch (dbErr) {
                                        console.error('❌ Gagal menghapus task:', dbErr);
                                        result.reply = 'gagal hapus tugas, coba lagi';
                                    }
                                }

                                // Integrasi Database: ADD_SCHEDULE
                                if (result.intent === 'ADD_SCHEDULE' && (result.entities.subject_name || result.entities.description) && result.entities.start_time) {
                                    try {
                                        const cleanSender = from.split('@')[0].split(':')[0];
                                        const userId = await userService.getOrCreateUserByPhone(cleanSender);
                                        const subject = result.entities.subject_name || result.entities.description || 'Kegiatan Rutin';
                                        
                                        // Default ke hari ini jika day_of_week null/undefined
                                        const currentDay = new Date().getDay();
                                        const dayOfWeek = (result.entities.day_of_week !== null && result.entities.day_of_week !== undefined
                                            ? result.entities.day_of_week
                                            : currentDay) % 7;

                                        await scheduleService.addSchedule({
                                            userId,
                                            subject,
                                            dayOfWeek,
                                            startTime: result.entities.start_time,
                                            endTime: result.entities.end_time || result.entities.start_time
                                        });
                                        console.log(`✅ Berhasil mencatat jadwal rutin ${subject}`);
                                    } catch (dbErr) {
                                        console.error('❌ Gagal mencatat jadwal:', dbErr);
                                        result.reply = 'gagal nyimpen jadwal, coba lagi';
                                    }
                                }

                                // Integrasi Database: SET_BALANCE
                                if (result.intent === 'SET_BALANCE' && (result.entities.account || result.entities.description) && result.entities.amount) {
                                    try {
                                        const cleanSender = from.split('@')[0].split(':')[0];
                                        const userId = await userService.getOrCreateUserByPhone(cleanSender);
                                        const accountName = result.entities.account || result.entities.description || 'Cash';

                                        await transactionService.setAccountBalance(userId, accountName, result.entities.amount);
                                        console.log(`✅ Berhasil set saldo ${accountName} sebesar Rp${result.entities.amount}`);

                                        const fmtBalance = result.entities.amount.toLocaleString('id-ID');
                                        result.reply += `\n  ${accountName}: Rp ${fmtBalance}`;
                                    } catch (dbErr) {
                                        console.error('❌ Gagal set saldo rekening:', dbErr);
                                    }
                                }

                                // Integrasi Database: SET_BUDGET
                                if (result.intent === 'SET_BUDGET' && result.entities.category && result.entities.amount) {
                                    try {
                                        const cleanSender = from.split('@')[0].split(':')[0];
                                        const userId = await userService.getOrCreateUserByPhone(cleanSender);
                                        await budgetService.setBudget({
                                            userId,
                                            categoryName: result.entities.category,
                                            amount: result.entities.amount
                                        });
                                        console.log(`✅ Berhasil set budget ${result.entities.category} Rp${result.entities.amount}`);
                                    } catch (dbErr) {
                                        console.error('❌ Gagal set budget:', dbErr);
                                        result.reply = 'Maaf bos, gagal menyimpan budget ke database.';
                                    }
                                }

                                // Integrasi Database: ADD_DEBT & ADD_RECEIVABLE
                                if (['ADD_DEBT', 'ADD_RECEIVABLE'].includes(result.intent) && result.entities.person_name && result.entities.amount) {
                                    try {
                                        const cleanSender = from.split('@')[0].split(':')[0];
                                        const userId = await userService.getOrCreateUserByPhone(cleanSender);
                                        const debtType = result.intent === 'ADD_DEBT' ? 'PAYABLE' : 'RECEIVABLE';

                                        await debtService.recordDebt({
                                            userId,
                                            personName: result.entities.person_name,
                                            type: debtType,
                                            amount: result.entities.amount,
                                            currency: result.entities.currency || 'IDR',
                                            description: result.entities.description
                                        });
                                        console.log(`✅ Berhasil mencatat ${debtType} atas nama ${result.entities.person_name} sebesar Rp${result.entities.amount}`);

                                        // Tampilkan total hutang/piutang aktif ke orang ini
                                        const { data: existingDebts } = await supabase
                                            .from('debts')
                                            .select('remaining_amount, description, created_at')
                                            .eq('user_id', userId)
                                            .ilike('person_name', result.entities.person_name)
                                            .in('status', ['UNPAID', 'PARTIAL']);

                                        if (existingDebts && existingDebts.length > 0) {
                                            const totalRemaining = existingDebts.reduce((sum: number, d: any) => sum + Number(d.remaining_amount || 0), 0);
                                            const label = debtType === 'PAYABLE' ? 'Hutangku ke' : 'Piutang dari';
                                            result.reply += `\n\n📋 *${label} ${result.entities.person_name}*: Rp ${totalRemaining.toLocaleString('id-ID')} total`;
                                            if (existingDebts.length > 1) {
                                                for (const d of existingDebts) {
                                                    result.reply += `\n  • Rp ${Number(d.remaining_amount).toLocaleString('id-ID')}${d.description ? ' (' + d.description + ')' : ''}`;
                                                }
                                            }
                                        }
                                    } catch (dbErr) {
                                        console.error('❌ Gagal mencatat hutang/piutang:', dbErr);
                                        result.reply = 'gagal nyimpen, coba lagi';
                                    }
                                }

                                // Integrasi Database: PAY_DEBT
                                if (result.intent === 'PAY_DEBT' && result.entities.person_name && result.entities.amount) {
                                    try {
                                        const cleanSender = from.split('@')[0].split(':')[0];
                                        const userId = await userService.getOrCreateUserByPhone(cleanSender);

                                        const payResult = await debtService.payDebt({
                                            userId,
                                            personName: result.entities.person_name,
                                            amount: result.entities.amount
                                        });

                                        if (payResult) {
                                            console.log(`✅ Berhasil mencatat pelunasan ${payResult.personName} Rp${payResult.paidAmount}`);
                                            const paidFmt = payResult.paidAmount.toLocaleString('id-ID');
                                            const remainFmt = payResult.remainingAmount.toLocaleString('id-ID');
                                            const label = payResult.debtType === 'PAYABLE' ? 'Hutangku ke' : 'Piutang dari';

                                            if (payResult.status === 'PAID') {
                                                result.reply += `\n\n📋 *${label} ${payResult.personName}* LUNAS ✓`;
                                            } else {
                                                result.reply += `\n\n📋 *${label} ${payResult.personName}*\n  Bayar: Rp ${paidFmt}\n  Sisa: Rp ${remainFmt}`;
                                            }
                                        } else {
                                            result.reply += `\n\n(tidak ditemukan catatan hutang atas nama ${result.entities.person_name})`;
                                        }
                                    } catch (dbErr) {
                                        console.error('❌ Gagal mencatat pelunasan:', dbErr);
                                        result.reply = 'gagal nyimpen, coba lagi';
                                    }
                                }
                                // Integrasi Database: CREATE_GOAL
                                if (result.intent === 'CREATE_GOAL' && (result.entities.goal_name || result.entities.description) && result.entities.amount) {
                                    try {
                                        const cleanSender = from.split('@')[0].split(':')[0];
                                        const userId = await userService.getOrCreateUserByPhone(cleanSender);
                                        const goalName = result.entities.goal_name || result.entities.description || 'Target Baru';

                                        await goalService.createGoal({
                                            userId,
                                            name: goalName,
                                            targetAmount: result.entities.amount || 0,
                                            targetDate: result.entities.due_date,
                                            currency: result.entities.currency || 'IDR'
                                        });
                                        console.log(`✅ Berhasil membuat goal "${goalName}" target Rp${result.entities.amount}`);
                                    } catch (dbErr) {
                                        console.error('❌ Gagal membuat goal:', dbErr);
                                    }
                                }

                                // Integrasi Database: DELETE_GOAL
                                if (result.intent === 'DELETE_GOAL' && (result.entities.goal_name || result.entities.description)) {
                                    try {
                                        const cleanSender = from.split('@')[0].split(':')[0];
                                        const userId = await userService.getOrCreateUserByPhone(cleanSender);
                                        const goalName = result.entities.goal_name || result.entities.description || '';

                                        const deletedName = await goalService.deleteGoal(userId, goalName);
                                        if (deletedName) {
                                            console.log(`✅ Berhasil menghapus goal "${deletedName}"`);
                                            result.reply = `target tabungan *${deletedName}* berhasil dihapus 🗑️`;
                                        } else {
                                            result.reply = `target tabungan "${goalName}" ga ketemu`;
                                        }
                                    } catch (dbErr) {
                                        console.error('❌ Gagal menghapus goal:', dbErr);
                                        result.reply = 'gagal hapus tabungan, coba lagi';
                                    }
                                }

                                // Integrasi Database: TOPUP_GOAL
                                if (result.intent === 'TOPUP_GOAL' && (result.entities.goal_name || result.entities.description) && result.entities.amount) {
                                    try {
                                        const cleanSender = from.split('@')[0].split(':')[0];
                                        const userId = await userService.getOrCreateUserByPhone(cleanSender);
                                        const goalName = result.entities.goal_name || result.entities.description || '';

                                        const topupRes = await goalService.topupGoal({
                                            userId,
                                            goalName,
                                            amount: result.entities.amount
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

                                            result.reply +=
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
                                if (['ADD_EXPENSE', 'ADD_INCOME'].includes(result.intent) && result.entities.amount) {
                                    try {
                                        // 1. Dapatkan atau buat userId berdasarkan nomor WhatsApp
                                        const cleanSender = from.split('@')[0].split(':')[0];
                                        const userId = await userService.getOrCreateUserByPhone(cleanSender);

                                        // 2. Simpan transaksi
                                        const txType = result.intent === 'ADD_EXPENSE' ? 'expense' : 'income';
                                        const txResult = await transactionService.recordTransaction({
                                            userId,
                                            type: txType,
                                            amount: result.entities.amount,
                                            currency: result.entities.currency || 'IDR',
                                            accountName: result.entities.account,
                                            categoryName: result.entities.category,
                                            description: result.entities.description
                                        });

                                        console.log(`✅ Berhasil mencatat ${txType} ke database`);

                                        // Tampilkan saldo rekening setelah transaksi
                                        const accName = result.entities.account || 'Cash';
                                        const fmtBalance = txResult.newBalance.toLocaleString('id-ID');
                                        result.reply += `\n  saldo ${accName}: Rp ${fmtBalance}`;

                                        // Jika ada konversi mata uang (misal USD -> IDR), tambahkan info konversi ke balasan Aira
                                        if (txResult.converted) {
                                            const formattedFinal = txResult.finalAmount.toLocaleString('id-ID');
                                            result.reply += `\n💱 ${txResult.originalAmount} ${txResult.originalCurrency} ≈ Rp ${formattedFinal}`;
                                        }

                                        // Cek peringatan budget (Auto-Warning) jika transaksi adalah pengeluaran
                                        if (txType === 'expense' && result.entities.category) {
                                            const budgetWarning = await budgetService.checkBudgetWarning({
                                                userId,
                                                categoryName: result.entities.category
                                            });
                                            if (budgetWarning) {
                                                result.reply += budgetWarning;
                                            }
                                        }
                                    } catch (dbErr) {
                                        console.error('❌ Gagal mencatat ke database:', dbErr);
                                        result.reply = 'gagal nyimpen, coba lagi';
                                    }
                                }

                                // Hentikan status "ngetik"
                                await sock.sendPresenceUpdate('paused', from);

                                // Balas pesan ke user
                                await sock.sendMessage(from, { text: sanitizeWhatsAppText(result.reply) });
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

