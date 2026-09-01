import { createClient } from '@/lib/supabase/server';
import KanbanBoard from '@/components/KanbanBoard';
import { CheckSquare, Plus } from 'lucide-react';

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
    <div className="pt-8 pb-32 h-screen flex flex-col bg-surface overflow-hidden">
      {/* Header */}
      <header className="px-6 flex justify-between items-center mb-6 shrink-0">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-on-surface">Tugas</h1>
          <p className="text-secondary text-sm mt-1">Lacak pekerjaanmu (Kanban)</p>
        </div>
        <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-primary relative">
          <Plus className="w-5 h-5" />
        </div>
      </header>
      
      {/* Kanban Board Container - Takes remaining height */}
      <div className="flex-1 overflow-hidden">
         <KanbanBoard initialTasks={tasks} />
      </div>
    </div>
  );
}
