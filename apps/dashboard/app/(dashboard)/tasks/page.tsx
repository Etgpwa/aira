import { createClient } from '@/lib/supabase/server';
import KanbanBoard from '@/components/KanbanBoard';
import AddTaskModal from '@/components/AddTaskModal';
import './page.css';

// Cache halaman selama 30 detik, Realtime Subscriber akan trigger router.refresh() jika ada data baru
export const revalidate = 30;

export default async function TasksPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;

  let tasks: any[] = [];

  if (userId) {
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .order('due_date', { ascending: true, nullsFirst: false });
    
    tasks = data || [];
  }

  return (
    <div className="tasks-container">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Tugas</h1>
        {userId && <AddTaskModal userId={userId} />}
      </div>
      <KanbanBoard initialTasks={tasks} />
    </div>
  );
}
