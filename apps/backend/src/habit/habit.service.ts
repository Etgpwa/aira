import { supabase } from '../supabase/supabase.client';
import { normalizeIsoDate } from '../utils/date.utils';

export interface HabitLog {
    id: string;
    user_id: string;
    habit_type: 'WAKE_UP' | 'SLEEP' | 'START_WORK' | 'STOP_WORK' | 'START_STUDY' | 'STOP_STUDY' | 'EXERCISE' | 'TIME_SINK';
    custom_label?: string;
    logged_at: string;
    duration_minutes?: number;
    notes?: string;
    source: 'WA' | 'PWA';
}

export class HabitService {
    async logHabit(
        userId: string,
        habitType: string,
        loggedAt: string,
        durationMinutes?: number | null,
        customLabel?: string | null,
        notes?: string | null,
        source: 'WA' | 'PWA' = 'WA'
    ) {
        const isoLoggedAt = normalizeIsoDate(loggedAt) || new Date(loggedAt).toISOString();
        
        const { data, error } = await supabase
            .from('habit_logs')
            .insert({
                user_id: userId,
                habit_type: habitType,
                logged_at: isoLoggedAt,
                duration_minutes: durationMinutes || null,
                custom_label: customLabel || null,
                notes: notes || null,
                source: source
            })
            .select()
            .single();

        if (error) {
            console.error('❌ Error logging habit:', error);
            throw error;
        }
        return data;
    }

    async undoLastHabitLog(userId: string) {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const { data: logs, error: fetchError } = await supabase
            .from('habit_logs')
            .select('*')
            .eq('user_id', userId)
            .gte('logged_at', startOfDay.toISOString())
            .order('logged_at', { ascending: false })
            .limit(1);

        if (fetchError || !logs || logs.length === 0) {
            return null; 
        }

        const lastLog = logs[0];
        const { error: deleteError } = await supabase
            .from('habit_logs')
            .delete()
            .eq('id', lastLog.id);

        if (deleteError) {
            console.error('❌ Error undoing habit log:', deleteError);
            throw deleteError;
        }

        return lastLog;
    }

    async queryHabitSummary(userId: string, query: string): Promise<string> {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const { data: logs, error } = await supabase
            .from('habit_logs')
            .select('*')
            .eq('user_id', userId)
            .gte('logged_at', startOfDay.toISOString())
            .order('logged_at', { ascending: true });

        if (error) {
            console.error('❌ Error querying habits:', error);
            return 'Maaf, gagal mengambil data habit.';
        }

        if (!logs || logs.length === 0) {
            return 'Belum ada catatan habit hari ini.';
        }

        let summary = 'REKAP HABIT HARI INI:\n';
        const typeMap: Record<string, string> = {
            'WAKE_UP': 'Bangun tidur',
            'SLEEP': 'Mulai tidur',
            'START_WORK': 'Mulai kerja',
            'STOP_WORK': 'Selesai kerja',
            'START_STUDY': 'Mulai belajar',
            'STOP_STUDY': 'Selesai belajar',
            'EXERCISE': 'Olahraga',
            'TIME_SINK': 'Screen time'
        };

        for (const log of logs) {
            const time = new Date(log.logged_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
            let label = typeMap[log.habit_type] || log.habit_type;
            if (log.habit_type === 'TIME_SINK' && log.custom_label) {
                label = log.custom_label;
            }
            let durationStr = log.duration_minutes ? ` (${log.duration_minutes} mnt)` : '';
            summary += `• ${time} — ${label}${durationStr}\n`;
        }

        return summary.trim();
    }
}

export const habitService = new HabitService();
