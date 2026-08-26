import { supabase } from '../supabase/supabase.client';

export class ScheduleService {
    async addSchedule(params: {
        userId: string;
        subject: string;
        dayOfWeek: number;
        startTime: string;
        endTime: string;
    }) {
        const validDayOfWeek = Math.abs(Number(params.dayOfWeek) || 0) % 7;

        let start = params.startTime;
        if (start.length === 5) start += ":00"; 
        
        let end = params.endTime;
        if (end.length === 5) end += ":00";

        const { error } = await supabase
            .from('study_schedules')
            .insert({
                user_id: params.userId,
                subject: params.subject,
                day_of_week: validDayOfWeek,
                start_time: start,
                end_time: end
            });

        if (error) {
            console.error("Gagal menambah jadwal rutin:", error);
            throw error;
        }
        return true;
    }
}

export const scheduleService = new ScheduleService();
