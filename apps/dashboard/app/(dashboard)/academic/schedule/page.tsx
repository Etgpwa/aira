import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import UtPlannerClient from './components/UtPlannerClient';

export const revalidate = 0;

export default async function UtAcademicPlannerPage() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    const userId = user.id;

    // Fetch user settings, schedules, weekly targets, dan modules secara paralel
    const [settingsRes, schedRes, targetsRes, modulesRes] = await Promise.all([
        supabase
            .from('user_settings')
            .select('semester_start_date')
            .eq('user_id', userId)
            .maybeSingle(),
        supabase
            .from('course_schedules')
            .select('*')
            .eq('user_id', userId)
            .order('day_of_week', { ascending: true })
            .order('start_time', { ascending: true }),
        supabase
            .from('course_weekly_targets')
            .select('*')
            .eq('user_id', userId)
            .order('week_number', { ascending: true }),
        supabase
            .from('course_modules')
            .select('*, course_quiz_questions(count)')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
    ]);

    const semesterStartDate = settingsRes.data?.semester_start_date || null;

    // Hitung minggu berjalan saat ini
    let currentWeekNumber = 1;
    if (semesterStartDate) {
        const startDate = new Date(semesterStartDate + 'T00:00:00');
        const today = new Date();
        if (today >= startDate) {
            const diffTime = Math.abs(today.getTime() - startDate.getTime());
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            currentWeekNumber = Math.floor(diffDays / 7) + 1;
        }
    }

    return (
        <UtPlannerClient
            initialSemesterStartDate={semesterStartDate}
            currentWeekNumber={currentWeekNumber}
            schedules={schedRes.data || []}
            weeklyTargets={targetsRes.data || []}
            modules={modulesRes.data || []}
        />
    );
}
