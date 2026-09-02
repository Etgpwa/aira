import { createClient } from '@/lib/supabase/server';
import UnifiedScheduleView from './components/UnifiedScheduleView';

export const revalidate = 30;

export default async function SchedulePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;

  let studySchedules: any[] = [];
  let courseSchedules: any[] = [];
  let courseModules: any[] = [];
  let therapySchedules: any[] = [];

  if (userId) {
    const [studyRes, courseRes, moduleRes, therapyRes] = await Promise.all([
      supabase
        .from('study_schedules')
        .select('*')
        .eq('user_id', userId)
        .order('start_time', { ascending: true }),
      supabase
        .from('course_schedules')
        .select('*')
        .eq('user_id', userId)
        .order('start_time', { ascending: true }),
      supabase
        .from('course_modules')
        .select('id, subject_name, module_title, kb_title, is_completed')
        .eq('user_id', userId)
        .order('created_at', { ascending: true }),
      supabase
        .from('therapy_schedules')
        .select('*')
        .eq('user_id', userId)
        .order('session_number', { ascending: true })
    ]);

    studySchedules = studyRes.data || [];
    courseSchedules = courseRes.data || [];
    courseModules = moduleRes.data || [];
    therapySchedules = therapyRes.data || [];
  }

  return (
    <div className="h-full flex flex-col bg-surface overflow-hidden">
      {/* Header Halaman */}
      <header className="px-6 flex justify-between items-center mb-4 shrink-0">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-on-surface">Jadwal Terpadu</h1>
          <p className="text-secondary text-sm mt-0.5">Kuliah, terapi anak, dan agenda harian</p>
        </div>
      </header>

      {/* Unified Master Schedule Board */}
      <div className="flex-1 overflow-hidden">
        <UnifiedScheduleView
          studySchedules={studySchedules}
          courseSchedules={courseSchedules}
          courseModules={courseModules}
          therapySchedules={therapySchedules}
        />
      </div>
    </div>
  );
}
