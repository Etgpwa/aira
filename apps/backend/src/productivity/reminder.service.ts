import { supabase } from '../supabase/supabase.client';
import { normalizeIsoDate } from '../utils/date.utils';
import { taskService } from './task.service';

export class ReminderService {
    private processingReminderIds: Set<string> = new Set();

    /**
     * Membuat pengingat baru.
     * Otomatis menghubungkan dengan task di Kanban jika namanya cocok.
     */
    async createReminder(params: {
        userId: string;
        message: string;
        remindAt: string;
        taskTitle?: string | null;
    }) {
        let taskId: string | null = null;
        let linkedTaskTitle: string | null = null;

        // Coba cari apakah terkait dengan tugas di Kanban
        const searchTitle = params.taskTitle || params.message;
        if (searchTitle) {
            const { exactMatch, candidates } = await taskService.findSimilarTasks({
                userId: params.userId,
                queryTitle: searchTitle,
                statuses: ['TODO', 'IN_PROGRESS']
            });

            if (exactMatch) {
                taskId = exactMatch.id;
                linkedTaskTitle = exactMatch.title;
            } else if (candidates.length > 0 && candidates[0].score >= 0.55) {
                taskId = candidates[0].task.id;
                linkedTaskTitle = candidates[0].task.title;
            }
        }

        const isoRemindAt = normalizeIsoDate(params.remindAt) || new Date(params.remindAt).toISOString();

        const { data, error } = await supabase
            .from('reminders')
            .insert({
                user_id: params.userId,
                task_id: taskId,
                message: params.message,
                remind_at: isoRemindAt,
                status: 'PENDING'
            })
            .select()
            .single();

        if (error) {
            console.error('❌ Gagal membuat reminder di database:', error);
            throw error;
        }

        return {
            reminder: data,
            linkedTaskTitle
        };
    }

    /**
     * Menjadwalkan ulang / mengundur pengingat aktif
     */
    async rescheduleReminder(params: {
        userId: string;
        query: string;
        newRemindAt: string;
    }) {
        // Ambil reminder PENDING dan SENT terakhir
        const { data: reminders, error } = await supabase
            .from('reminders')
            .select('*')
            .eq('user_id', params.userId)
            .in('status', ['PENDING', 'SENT'])
            .order('remind_at', { ascending: false })
            .limit(20);

        if (error || !reminders || reminders.length === 0) {
            return null;
        }

        const now = Date.now();
        const fifteenMinsMs = 15 * 60 * 1000;

        // Filter kandidat yang valid:
        // - status 'PENDING' (belum bunyi)
        // - status 'SENT' tapi baru bunyi <= 15 menit yang lalu
        const eligibleReminders = reminders.filter(r => {
            if (r.status === 'PENDING') return true;
            if (r.status === 'SENT') {
                const rangAt = new Date(r.remind_at).getTime();
                return (now - rangAt) <= fifteenMinsMs;
            }
            return false;
        });

        if (eligibleReminders.length === 0) {
            return null;
        }

        const q = params.query.trim().toLowerCase();
        let target: any = null;
        if (q) {
            target = eligibleReminders.find(r => r.message.toLowerCase().includes(q));
        }
        if (!target) {
            // Ambil reminder yang paling baru
            target = eligibleReminders[0];
        }

        const isoNewRemindAt = normalizeIsoDate(params.newRemindAt) || new Date(params.newRemindAt).toISOString();

        const { data: updated, error: updateErr } = await supabase
            .from('reminders')
            .update({
                remind_at: isoNewRemindAt,
                status: 'PENDING', // Kembalikan ke PENDING agar cron bisa mengirimkannya lagi!
                updated_at: new Date().toISOString()
            })
            .eq('id', target.id)
            .select()
            .single();

        if (updateErr) {
            console.error('❌ Gagal reschedule reminder:', updateErr);
            return null;
        }

        // Jika reminder terhubung dengan task di Kanban, update juga due_date task tersebut
        if (target.task_id) {
            await supabase
                .from('tasks')
                .update({
                    due_date: isoNewRemindAt,
                    updated_at: new Date().toISOString()
                })
                .eq('id', target.task_id);
            console.log(`✅ Deadline task Kanban (id: ${target.task_id}) ikut diupdate ke ${isoNewRemindAt}`);
        }

        return updated;
    }

    /**
     * Membatalkan pengingat aktif
     */
    async deleteReminder(params: {
        userId: string;
        query: string;
    }) {
        const { data: reminders, error } = await supabase
            .from('reminders')
            .select('*')
            .eq('user_id', params.userId)
            .eq('status', 'PENDING')
            .order('remind_at', { ascending: true });

        if (error || !reminders || reminders.length === 0) {
            return null;
        }

        const q = params.query.trim().toLowerCase();
        let target = reminders.find(r => r.message.toLowerCase().includes(q));
        if (!target && reminders.length === 1) {
            target = reminders[0];
        }

        if (!target) {
            target = reminders[0];
        }

        const { data: cancelled, error: delErr } = await supabase
            .from('reminders')
            .update({
                status: 'CANCELLED',
                updated_at: new Date().toISOString()
            })
            .eq('id', target.id)
            .select()
            .single();

        if (delErr) {
            console.error('❌ Gagal membatalkan reminder:', delErr);
            return null;
        }

        return cancelled;
    }

    /**
     * Mengecek dan mengirimkan semua pengingat yang jatuh tempo
     */
    async processDueReminders(sendFn: (phone: string, text: string) => Promise<boolean>, fallbackNumbers: string[]) {
        try {
            const nowIso = new Date().toISOString();

            // Ambil semua reminder PENDING yang remind_at <= sekarang
            const { data: dueReminders, error } = await supabase
                .from('reminders')
                .select('*, tasks(id, title, status)')
                .eq('status', 'PENDING')
                .lte('remind_at', nowIso);

            if (error || !dueReminders || dueReminders.length === 0) {
                return;
            }

            console.log(`⏰ Ditemukan ${dueReminders.length} custom reminder yang jatuh tempo.`);

            for (const item of dueReminders) {
                // 0. Guard in-memory agar 1 proses tidak mengeksekusi reminder yang sama secara bersamaan
                if (this.processingReminderIds.has(item.id)) {
                    continue;
                }
                this.processingReminderIds.add(item.id);

                try {
                    // 1. Jika terhubung dengan task di Kanban, cek statusnya
                    if (item.task_id && item.tasks) {
                        const taskStatus = (item.tasks as any).status;
                        if (taskStatus === 'DONE') {
                            console.log(`ℹ️ Task "${(item.tasks as any).title}" sudah DONE, custom reminder dibatalkan.`);
                            await supabase
                                .from('reminders')
                                .update({ status: 'CANCELLED', updated_at: new Date().toISOString() })
                                .eq('id', item.id);
                            continue;
                        }
                    }

                    // 2. Atomic claim di database Supabase:
                    // Klaim reminder dengan mengupdate status 'PENDING' -> 'SENT' secara langsung.
                    // Jika ada proses lain yang mengeksekusi bersamaan, update hanya akan berhasil pada 1 pemenang.
                    const { data: claimed, error: claimErr } = await supabase
                        .from('reminders')
                        .update({ status: 'SENT', updated_at: new Date().toISOString() })
                        .eq('id', item.id)
                        .eq('status', 'PENDING')
                        .select('id');

                    if (claimErr || !claimed || claimed.length === 0) {
                        console.log(`ℹ️ Reminder [${item.id}] sudah di-claim oleh instance/proses lain, lewati.`);
                        continue;
                    }

                    // 3. Dapatkan nomor tujuan dari user_settings
                    const numbersToSend: string[] = [];
                    const { data: userSetting } = await supabase
                        .from('user_settings')
                        .select('phone_number')
                        .eq('user_id', item.user_id)
                        .single();

                    if (userSetting && userSetting.phone_number) {
                        const rawList = userSetting.phone_number.split(',').map((p: string) => p.trim()).filter(Boolean);
                        
                        // Prioritaskan LID (misal: 252093474578602 atau yang berakhiran @lid)
                        const lid = rawList.find((p: string) => {
                            const digits = p.replace(/[^0-9]/g, '');
                            return p.endsWith('@lid') || (digits.length >= 15 && !digits.startsWith('62') && !digits.startsWith('08'));
                        });

                        if (lid) {
                            const cleanLid = lid.replace(/[^0-9]/g, '');
                            numbersToSend.push(`${cleanLid}@lid`);
                        } else if (rawList.length > 0) {
                            // Fallback ke nomor HP biasa jika tidak ada LID
                            const clean = rawList[0].replace(/[^0-9]/g, '');
                            numbersToSend.push(clean);
                        }
                    }

                    if (numbersToSend.length === 0 && fallbackNumbers.length > 0) {
                        numbersToSend.push(fallbackNumbers[0]);
                    }

                    const remindTimeStr = new Date(item.remind_at).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone: 'Asia/Jakarta'
                    });

                    const reminderText = `⏰ *PENGINGAT*\n${item.message}\n(Waktu: ${remindTimeStr} WIB)`;

                    let anySuccess = false;
                    for (const num of numbersToSend) {
                        const sent = await sendFn(num, reminderText);
                        if (sent) anySuccess = true;
                    }

                    if (!anySuccess) {
                        // Rollback status ke PENDING jika pengiriman WA gagal total
                        await supabase
                            .from('reminders')
                            .update({ status: 'PENDING', updated_at: new Date().toISOString() })
                            .eq('id', item.id);
                        console.warn(`⚠️ Custom reminder [${item.message}] gagal kirim, dikembalikan ke PENDING.`);
                    } else {
                        console.log(`✅ Custom reminder [${item.message}] berhasil dikirim.`);
                    }
                } finally {
                    this.processingReminderIds.delete(item.id);
                }
            }
        } catch (err) {
            console.error('❌ Error saat memproses due reminders:', err);
        }
    }
}

export const reminderService = new ReminderService();
