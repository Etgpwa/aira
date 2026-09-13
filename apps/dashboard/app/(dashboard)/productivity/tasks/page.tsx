import { createClient } from '@/lib/supabase/server';
import dynamic from 'next/dynamic';
import AddTaskModal from './components/AddTaskModal';
import Link from 'next/link';

const KanbanBoard = dynamic(() => import('@/components/KanbanBoard'), {
  ssr: false,
  loading: () => (
    <div className="flex gap-4 p-6 overflow-x-auto h-full">
      <div className="w-80 h-96 bg-surface-container rounded-2xl animate-pulse flex-shrink-0" />
      <div className="w-80 h-96 bg-surface-container rounded-2xl animate-pulse flex-shrink-0" />
      <div className="w-80 h-96 bg-surface-container rounded-2xl animate-pulse flex-shrink-0" />
    </div>
  ),
});

const UnifiedScheduleView = dynamic(() => import('../agenda/components/UnifiedScheduleView'), {
  ssr: false,
  loading: () => (
    <div className="p-6 space-y-4">
      <div className="w-full h-32 bg-surface-container rounded-2xl animate-pulse" />
      <div className="w-full h-32 bg-surface-container rounded-2xl animate-pulse" />
    </div>
  ),
});

export const revalidate = 30;

export default async function TasksPage({ searchParams }: { searchParams: { tab?: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;

  const currentTab = searchParams.tab || 'tugas';

  let tasks: any[] = [];
  let studySchedules: any[] = [];
  let courseSchedules: any[] = [];
  let courseModules: any[] = [];
  let therapySchedules: any[] = [];

  if (userId) {
    if (currentTab === 'tugas') {
      const { data } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .order('due_date', { ascending: true, nullsFirst: false });
      
      tasks = data || [];
    } else {
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
  }

  return (
    <div className="h-full flex flex-col bg-surface overflow-hidden">
      {/* Header */}
      <header className="px-6 flex justify-between items-center mb-4 shrink-0 mt-2">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-on-surface">Produktivitas</h1>
          <p className="text-secondary text-sm mt-1">Lacak tugas dan jadwal harianmu</p>
        </div>
        
        {/* Tombol Tambah Tugas di Header */}
        {currentTab === 'tugas' && <AddTaskModal />}
      </header>

      {/* Tab Switcher */}
      <div className="px-6 mb-4 shrink-0">
        <div className="bg-surface-container-low p-1 rounded-full flex gap-1">
          <Link 
            href="/productivity/tasks?tab=tugas" 
            className={`flex-1 text-center py-2 text-sm font-bold rounded-full transition-colors ${currentTab === 'tugas' ? 'bg-primary text-on-primary shadow-sm' : 'text-secondary hover:text-on-surface hover:bg-surface-container'}`}
          >
            Tugas (Kanban)
          </Link>
          <Link 
            href="/productivity/tasks?tab=jadwal" 
            className={`flex-1 text-center py-2 text-sm font-bold rounded-full transition-colors ${currentTab === 'jadwal' ? 'bg-primary text-on-primary shadow-sm' : 'text-secondary hover:text-on-surface hover:bg-surface-container'}`}
          >
            Jadwal
          </Link>
        </div>
      </div>
      
      {/* Content Container - Takes remaining height */}
      <div className="flex-1 overflow-hidden">
        {currentTab === 'tugas' ? (
          <KanbanBoard initialTasks={tasks} />
        ) : (
          <UnifiedScheduleView
            studySchedules={studySchedules}
            courseSchedules={courseSchedules}
            courseModules={courseModules}
            therapySchedules={therapySchedules}
          />
        )}
      </div>
    </div>
  );
}
