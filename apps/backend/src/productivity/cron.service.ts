import cron from 'node-cron';
import { supabase } from '../supabase/supabase.client';
import { agendaQueryService } from './agenda.query.service';
import { sanitizeWhatsAppText } from '../whatsapp/connection';
import { reminderService } from './reminder.service';
import { routineService } from '../routine/routine.service';
import { therapyService } from '../therapy/therapy.service';
import { academicService } from '../academic/academic.service';
import { quizService } from '../academic/quiz.service';

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

export class CronService {
    private sock: any;
    private sentReminders: Set<string> = new Set();

    init(sock: any) {
        this.sock = sock;
        console.log('✅ CronService initialized (socket ready).');

        // 1. Daily Briefing (Jalan setiap jam 06:00 pagi)
        cron.schedule('0 6 * * *', async () => {
            console.log('⏰ Menjalankan Daily Briefing...');
            await this.runDailyBriefing();
        }, {
            timezone: 'Asia/Jakarta'
        });

        // 2. Smart Reminder (Jalan setiap 15 menit)
        cron.schedule('*/15 * * * *', async () => {
            console.log('⏰ Mengecek Smart Reminders...');
            await this.runSmartReminders();
            await this.runScheduleReminders();
        });

        // 3. Debt Reminder (Jalan setiap jam 07:00 pagi)
        cron.schedule('0 7 * * *', async () => {
            console.log('⏰ Mengecek Debt Reminders...');
            await this.runDebtReminders();
        }, {
            timezone: 'Asia/Jakarta'
        });

        // 4. Custom Reminders (Jalan setiap 1 menit)
        cron.schedule('* * * * *', async () => {
            const realNumbers = this.getRealPhoneNumbers();
            await reminderService.processDueReminders(
                (phone, text) => this.safeSendMessage(phone, text),
                realNumbers
            );
        });

        // 5. Story Medsos Check (Jalan jam 15:30 sore, Senin s/d Sabtu)
        cron.schedule('30 15 * * 1-6', async () => {
            console.log('⏰ Menjalankan Reminder Story Medsos 15:30...');
            await this.runStoryReminder();
        }, {
            timezone: 'Asia/Jakarta'
        });
    }

    /** Dipanggil ketika terjadi reconnect agar sock selalu up-to-date */
    updateSock(sock: any) {
        this.sock = sock;
        console.log('🔄 CronService: sock reference diperbarui setelah reconnect.');
    }

    /**
     * Mendapatkan daftar nomor HP asli (bukan LID) dari env WHATSAPP_PHONE_NUMBER.
     * Format .env: "6287756987979,252093474578602" -> kita ambil angka < 15 digit saja (nomor HP), bukan LID panjang.
     */
    private getRealPhoneNumbers(): string[] {
        const raw = process.env.WHATSAPP_PHONE_NUMBER || '';
        const items = raw.split(',').map(n => n.trim()).filter(Boolean);

        // Jika ada LID, prioritaskan LID agar pesan masuk ke thread aktif WhatsApp pengguna
        const lid = items.find(n => {
            const digits = n.replace(/[^0-9]/g, '');
            return n.endsWith('@lid') || (digits.length >= 15 && !digits.startsWith('62') && !digits.startsWith('08'));
        });

        if (lid) {
            const clean = lid.replace(/[^0-9]/g, '');
            return [`${clean}@lid`];
        }

        return items
            .map(n => n.trim().replace(/[^0-9]/g, ''))
            .filter(n => n.length > 0 && n.length <= 15);
    }

    /**
     * Mengirim pesan WA dengan retry otomatis jika terjadi 408 Timeout.
     * Baileys kadang timeout saat socket idle karena USyncDevices query ke WA server.
     * Solusi: retry dengan jeda agar WA server punya waktu merespons.
     */
    private async safeSendMessage(phoneNumber: string, text: string, maxRetries = 3): Promise<boolean> {
        if (!this.sock) {
            console.warn('⚠️ CronService: sock belum siap, reminder dilewati.');
            return false;
        }

        // Ambil HANYA nomor pertama sebelum koma (hindari concat nomor asli + LID)
        const rawFirst = phoneNumber.split(',')[0].trim();
        const cleanNumber = rawFirst.replace(/[^0-9]/g, '');
        if (!cleanNumber) return false;

        // Bedakan antara nomor HP (@s.whatsapp.net) dan WhatsApp LID (@lid)
        let jid = '';
        if (rawFirst.endsWith('@lid') || (cleanNumber.length >= 15 && !cleanNumber.startsWith('62') && !cleanNumber.startsWith('08'))) {
            jid = `${cleanNumber}@lid`;
        } else if (rawFirst.endsWith('@s.whatsapp.net')) {
            jid = rawFirst;
        } else {
            const normalized = cleanNumber.startsWith('0') ? '62' + cleanNumber.slice(1) : cleanNumber;
            jid = `${normalized}@s.whatsapp.net`;
        }

        console.log(`📤 Mengirim reminder ke JID: ${jid}`);

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                // Jeda sedikit sebelum kirim agar connection tidak tiba-tiba "cold"
                if (attempt > 1) {
                    const waitMs = attempt * 3000; // 3s, 6s, 9s
                    console.log(`🔁 Retry ke-${attempt} mengirim reminder ke ${cleanNumber} dalam ${waitMs / 1000}s...`);
                    await sleep(waitMs);
                }

                await this.sock.sendMessage(jid, { text: sanitizeWhatsAppText(text) });
                console.log(`✅ Reminder terkirim ke ${cleanNumber} (attempt ${attempt})`);
                return true;
            } catch (err: any) {
                const is408 = err?.output?.statusCode === 408 || String(err).includes('Timed Out') || String(err).includes('408');
                if (is408 && attempt < maxRetries) {
                    console.warn(`⚠️ Timeout 408 saat kirim reminder (attempt ${attempt}/${maxRetries}), akan retry...`);
                    continue;
                }
                console.error(`❌ Gagal mengirim reminder ke ${cleanNumber} setelah ${attempt} percobaan:`, err?.message || err);
                return false;
            }
        }
        return false;
    }

    private async runDailyBriefing() {
        try {
            const realNumbers = this.getRealPhoneNumbers();
            if (realNumbers.length === 0) {
                console.warn('⚠️ Daily Briefing: WHATSAPP_PHONE_NUMBER tidak ada di .env, skip.');
                return;
            }

            const { data: users } = await supabase.from('user_settings').select('user_id, phone_number');
            if (!users) return;

            for (const user of users) {
                const context = await routineService.calculateDailyContext(user.user_id);
                const therapySchedule = await therapyService.answerScheduleQuery(user.user_id, 'jadwal terapi hari ini');

                const question = "Tolong kasih daily briefing: jadwalku hari ini apa aja dan tugas yang belum selesai. Buat format berbaris dengan bullet (•), pisahkan antar kategori dengan enter 1 kali saja, jangan gunakan emoji sama sekali, dan urutkan dari yang paling urgent.";
                const briefing = await agendaQueryService.answerAgendaQuery(user.user_id, question);
                
                let fullMessage = `DAILY BRIEFING (${context.dayName.toUpperCase()})\n`;
                if (context.isWorkDay) {
                    fullMessage += `\nSERAGAM HARI INI:\n• ${context.uniform}\n`;
                    if (context.department) {
                        fullMessage += `\nKONTEN MEDSOS HARI INI:\n• Take 1 Video Story: Departemen ${context.department}\n`;
                    }
                }

                if (briefing) {
                    fullMessage += `\n${briefing}\n`;
                }

                if (therapySchedule && !therapySchedule.includes('Belum ada jadwal')) {
                    fullMessage += `\n${therapySchedule}\n`;
                }

                // Injeksi Kuis Harian dari Matkul Kemarin
                try {
                    const yesterdayClasses = await academicService.getYesterdayCourseSchedule(user.user_id);
                    if (yesterdayClasses && yesterdayClasses.length > 0) {
                        // Ambil soal dari matkul-matkul tersebut
                        for (const course of yesterdayClasses) {
                            const q = await quizService.getQuizQuestions(user.user_id, course.subject_name, 5);
                            if (q && q.length > 0) {
                                // Tandai soal yang akan dikirim ini already_asked = true
                                await quizService.markQuestionsAsked(q.map(x => x.id));
                                
                                const currentWk = await academicService.getCurrentWeekNumber(user.user_id);
                                const qMsg = quizService.formatQuizMessage(course.subject_name, q, currentWk);
                                fullMessage += `\n---\n${qMsg}\n`;
                                
                                // Jika stok soal kurang dari 5 (misal sisa 2), reset soal matkul ini
                                if (q.length < 5) {
                                    await quizService.resetAskedFlags(user.user_id, course.subject_name);
                                }
                                break; // Hanya kirim 1 kuis per hari untuk matkul pertama yang ada soalnya (biar ngga kepanjangan)
                            } else {
                                // Jika tidak ada soal sisa, coba reset sekali, tapi tidak query ulang hari ini (besok baru keluar)
                                await quizService.resetAskedFlags(user.user_id, course.subject_name);
                            }
                        }
                    }
                } catch (qErr) {
                    console.error("Error cek kuis:", qErr);
                }

                for (const num of realNumbers) {
                    await this.safeSendMessage(num, fullMessage.trim());
                }
            }
        } catch (error) {
            console.error("Error saat Daily Briefing:", error);
        }
    }

    private async runStoryReminder() {
        try {
            const realNumbers = this.getRealPhoneNumbers();
            if (realNumbers.length === 0) return;

            const { data: users } = await supabase.from('user_settings').select('user_id');
            if (!users) return;

            for (const user of users) {
                const context = await routineService.calculateDailyContext(user.user_id);
                if (context.isWorkDay && context.department) {
                    const text = `PENGINGAT KONTEN MEDSOS\nHalo! Apakah sudah upload story video hari ini? (Hari ini giliran: Departemen *${context.department}*)`;
                    for (const num of realNumbers) {
                        await this.safeSendMessage(num, text);
                    }
                }
            }
        } catch (err) {
            console.error('Error saat Story Reminder 15:30:', err);
        }
    }

    private async runSmartReminders() {
        try {
            const now = new Date();
            const realNumbers = this.getRealPhoneNumbers();
            if (realNumbers.length === 0) return;

            const { data: tasks } = await supabase
                .from('tasks')
                .select('*')
                .in('status', ['TODO', 'IN_PROGRESS'])
                .not('due_date', 'is', null);

            if (!tasks || tasks.length === 0) return;

            for (const task of tasks) {
                const dueDate = new Date(task.due_date);
                const diffMs = dueDate.getTime() - now.getTime();
                const diffHours = diffMs / (1000 * 60 * 60);
                const dueTimeStr = dueDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });

                const h3Key = `${task.id}_H3`;
                const h1Key = `${task.id}_H1`;

                // H-3 Jam (window: 2.25 - 3.25 jam)
                if (diffHours > 2.25 && diffHours <= 3.25 && !this.sentReminders.has(h3Key)) {
                    let anySuccess = false;
                    for (const num of realNumbers) {
                        const ok = await this.safeSendMessage(num,
                            `REMINDER H-3 JAM\nTugas: *${task.title}*\nTenggat: ${dueTimeStr}`
                        );
                        if (ok) anySuccess = true;
                    }
                    if (anySuccess) this.sentReminders.add(h3Key);
                }

                // H-1 Jam / mendekati tenggat (window: -0.25 - 1.25 jam)
                if (diffHours > -0.25 && diffHours <= 1.25 && !this.sentReminders.has(h1Key)) {
                    let anySuccess = false;
                    for (const num of realNumbers) {
                        const ok = await this.safeSendMessage(num,
                            `REMINDER TENGGAT WAKTU\nTugas: *${task.title}*\nBatas waktu: ${dueTimeStr}`
                        );
                        if (ok) anySuccess = true;
                    }
                    if (anySuccess) this.sentReminders.add(h1Key);
                }
            }
        } catch (error) {
            console.error("Error saat Smart Reminders:", error);
        }
    }

    private async runScheduleReminders() {
        try {
            const nowStr = new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" });
            const nowJkt = new Date(nowStr);
            const currentDay = nowJkt.getDay();
            const currentHour = nowJkt.getHours();
            const currentMinute = nowJkt.getMinutes();
            const realNumbers = this.getRealPhoneNumbers();
            if (realNumbers.length === 0) return;

            const { data: schedules } = await supabase
                .from('study_schedules')
                .select('*')
                .eq('day_of_week', currentDay);

            if (!schedules || schedules.length === 0) return;

            for (const sched of schedules) {
                const [startH, startM] = sched.start_time.split(':').map(Number);
                const nowTotalMins = currentHour * 60 + currentMinute;
                const startTotalMins = startH * 60 + startM;
                const diffMins = startTotalMins - nowTotalMins;

                const schedKey = `${sched.id}_${nowJkt.toDateString()}`;

                if (diffMins > 0 && diffMins <= 30 && !this.sentReminders.has(schedKey)) {
                    let anySuccess = false;
                    for (const num of realNumbers) {
                        const ok = await this.safeSendMessage(num,
                            `REMINDER JADWAL\nKegiatan *${sched.subject}* mulai dalam ${diffMins} menit (${sched.start_time.slice(0, 5)}).`
                        );
                        if (ok) anySuccess = true;
                    }
                    if (anySuccess) this.sentReminders.add(schedKey);
                }
            }
        } catch (error) {
            console.error("Error saat Schedule Reminders:", error);
        }
    }

    private async runDebtReminders() {
        try {
            const now = new Date();
            const realNumbers = this.getRealPhoneNumbers();
            if (realNumbers.length === 0) return;

            const { data: debts } = await supabase
                .from('debts')
                .select('*')
                .in('status', ['UNPAID', 'PARTIAL'])
                .not('due_date', 'is', null);

            if (!debts || debts.length === 0) return;

            for (const debt of debts) {
                const dueDate = new Date(debt.due_date);
                const diffMs = dueDate.getTime() - now.getTime();
                const diffDays = diffMs / (1000 * 60 * 60 * 24);

                if (diffDays <= 1.5 && diffDays > -1) {
                    const label = debt.type === 'PAYABLE' ? 'Hutangku ke' : 'Piutang dari';
                    const remainingFmt = Number(debt.remaining_amount).toLocaleString('id-ID');
                    const debtKey = `${debt.id}_${now.toDateString()}`;

                    if (!this.sentReminders.has(debtKey)) {
                        let anySuccess = false;
                        for (const num of realNumbers) {
                            const ok = await this.safeSendMessage(num,
                                `REMINDER JATUH TEMPO\n${label} *${debt.person_name}* sebesar Rp ${remainingFmt} jatuh tempo pada ${dueDate.toLocaleDateString('id-ID')}.`
                            );
                            if (ok) anySuccess = true;
                        }
                        if (anySuccess) this.sentReminders.add(debtKey);
                    }
                }
            }
        } catch (error) {
            console.error("Error saat Debt Reminders:", error);
        }
    }
}

export const cronService = new CronService();
