import { supabase } from '../supabase/supabase.client';
import { askGeminiVision } from '../ai/gemini.client';

export interface CourseSchedule {
  subject_name: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string | null;
  lecturer: string | null;
}

const SCHEDULE_OCR_PROMPT = `Kamu adalah sistem ekstraksi jadwal kuliah otomatis. 
Foto ini adalah jadwal kuliah dengan format tabel grid (hari sebagai kolom, jam sebagai baris) atau format list/daftar.
Ekstrak SEMUA sesi kuliah yang ditemukan secara akurat.
Perhatikan baik-baik persilangan antara kolom hari dan baris jam.

Kembalikan HANYA array JSON ini (tanpa markdown backtick, tanpa penjelasan apapun):
[{
  "subject_name": "Nama Matakuliah",
  "day_of_week": 1,
  "start_time": "08:00",
  "end_time": "10:00",
  "room": "Nama Ruangan atau null",
  "lecturer": "Nama Dosen atau null"
}]

PENTING:
- day_of_week: 0=Minggu, 1=Senin, 2=Selasa, 3=Rabu, 4=Kamis, 5=Jumat, 6=Sabtu.
- Pastikan format jam HH:MM (contoh 08:30, bukan 8:30).
- Jika tidak ada jadwal ditemukan sama sekali, kembalikan array kosong: []`;

export class AcademicService {
    
    /**
     * 1. Set Semester Start Date di user_settings
     */
    async setSemesterStartDate(userId: string, startDateStr: string): Promise<boolean> {
        const { error } = await supabase
            .from('user_settings')
            .update({ semester_start_date: startDateStr })
            .eq('user_id', userId);
        
        if (error) {
            console.error("Error setSemesterStartDate:", error);
            return false;
        }
        return true;
    }

    /**
     * 2. Hitung Current Week (Minggu ke-N)
     */
    async getCurrentWeekNumber(userId: string): Promise<number> {
        const { data, error } = await supabase
            .from('user_settings')
            .select('semester_start_date')
            .eq('user_id', userId)
            .single();

        if (error || !data?.semester_start_date) {
            return 1; // Default minggu 1 jika belum diset
        }

        const startDate = new Date(data.semester_start_date);
        const today = new Date();
        
        if (today < startDate) return 1;

        const diffTime = Math.abs(today.getTime() - startDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return Math.floor(diffDays / 7) + 1; 
    }

    /**
     * 3. OCR Jadwal Kuliah & Simpan ke Supabase
     */
    async importScheduleFromImage(userId: string, imageBuffer: Buffer, mimeType: string): Promise<number> {
        try {
            const rawResponse = await askGeminiVision(
                imageBuffer,
                mimeType,
                SCHEDULE_OCR_PROMPT
            );

            const cleanJsonStr = rawResponse.replace(/```json/gi, '').replace(/```/gi, '').trim();
            const schedules: CourseSchedule[] = JSON.parse(cleanJsonStr);

            if (!Array.isArray(schedules) || schedules.length === 0) {
                return 0;
            }
            
            const insertData = schedules.map(s => ({
                user_id: userId,
                subject_name: s.subject_name,
                day_of_week: s.day_of_week,
                start_time: s.start_time,
                end_time: s.end_time,
                room: s.room || null,
                lecturer: s.lecturer || null
            }));

            const { error } = await supabase.from('course_schedules').insert(insertData);
            
            if (error) {
                console.error("DB Insert Error (course_schedules):", error);
                return 0;
            }

            return schedules.length;
        } catch (error) {
            console.error("Gagal melakukan OCR jadwal kuliah:", error);
            return 0;
        }
    }

    /**
     * 4. Query Kuliah Hari Ini
     */
    async getTodayCourseSchedule(userId: string): Promise<any[]> {
        const todayDay = new Date().getDay(); // 0-6
        const { data } = await supabase
            .from('course_schedules')
            .select('*')
            .eq('user_id', userId)
            .eq('day_of_week', todayDay)
            .order('start_time', { ascending: true });
        
        return data || [];
    }

    /**
     * 5. Query Kuliah Kemarin (untuk Cron Kuis)
     */
    async getYesterdayCourseSchedule(userId: string): Promise<any[]> {
        let yesterdayDay = new Date().getDay() - 1;
        if (yesterdayDay < 0) yesterdayDay = 6;

        const { data } = await supabase
            .from('course_schedules')
            .select('*')
            .eq('user_id', userId)
            .eq('day_of_week', yesterdayDay)
            .order('start_time', { ascending: true });
        
        return data || [];
    }

    /**
     * 6. Tambah Weekly Target Manual
     */
    async addWeeklyTarget(userId: string, subject: string, week: number, topic: string): Promise<boolean> {
        const { error } = await supabase
            .from('course_weekly_targets')
            .insert({
                user_id: userId,
                subject_name: subject,
                week_number: week,
                topic: topic
            });

        if (error) console.error(error);
        return !error;
    }

    /**
     * 7. Tandai Weekly Target Selesai
     */
    async completeWeeklyTarget(userId: string, subject: string, weekNumber?: number): Promise<boolean> {
        const targetWeek = weekNumber || await this.getCurrentWeekNumber(userId);

        const { error } = await supabase
            .from('course_weekly_targets')
            .update({ is_completed: true, completed_at: new Date().toISOString() })
            .eq('user_id', userId)
            .ilike('subject_name', `%${subject}%`)
            .eq('week_number', targetWeek);

        if (error) console.error(error);
        return !error;
    }

    /**
     * 8. Query Progress (ringkasan)
     */
    async queryProgress(userId: string): Promise<string> {
        const { data, error } = await supabase
            .from('course_weekly_targets')
            .select('subject_name, is_completed')
            .eq('user_id', userId);

        if (error || !data || data.length === 0) return "Belum ada data target belajar yang dicatat.";

        const stats: Record<string, { total: number, done: number }> = {};
        
        for (const item of data) {
            const sub = item.subject_name;
            if (!stats[sub]) stats[sub] = { total: 0, done: 0 };
            stats[sub].total++;
            if (item.is_completed) stats[sub].done++;
        }

        let reply = "PROGRES MATERI KULIAH:\n";
        for (const [sub, st] of Object.entries(stats)) {
            const pct = Math.round((st.done / st.total) * 100);
            reply += `• ${sub}: ${st.done}/${st.total} materi (${pct}%)\n`;
        }

        return reply;
    }
}

export const academicService = new AcademicService();
