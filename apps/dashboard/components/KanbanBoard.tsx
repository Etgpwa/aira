'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { ChevronRight, ChevronLeft, Trash2, Edit3, Clock, LayoutList, Loader2, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import Modal from './Modal';

type Task = any;

export default function KanbanBoard({ initialTasks }: { initialTasks: Task[] }) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [progressModalTask, setProgressModalTask] = useState<Task | null>(null);
  const [progressText, setProgressText] = useState('');
  const [isMovingToProgress, setIsMovingToProgress] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const supabase = createClient();

  const deleteTask = async (taskId: string) => {
    if (!confirm('Hapus tugas ini?')) return;

    setTasks(prev => prev.filter(t => t.id !== taskId));
    const { error } = await supabase.from('tasks').delete().eq('id', taskId);
    if (error) console.error("Gagal menghapus task:", error);
  };

  const todo = tasks.filter(t => t.status === 'TODO');
  const inProgress = tasks.filter(t => t.status === 'IN_PROGRESS');
  const done = tasks.filter(t => t.status === 'DONE');

  const priorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH': return 'bg-peach-bg text-peach-fg';
      case 'MEDIUM': return 'bg-warning/20 text-warning';
      case 'LOW': return 'bg-mint-bg text-mint-fg';
      default: return 'bg-surface-variant text-secondary';
    }
  };

  const updateStatus = async (taskId: string, newStatus: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    const { error } = await supabase
      .from('tasks')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', taskId);

    if (error) {
      console.error('Error updating task:', error);
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: prev.find(pt => pt.id === taskId)?.status } : t));
    }
  };

  const handleOpenProgressModal = (task: Task, movingFromTodo: boolean) => {
    setProgressModalTask(task);
    setProgressText(task.description || '');
    setIsMovingToProgress(movingFromTodo);
  };

  const handleSaveProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!progressModalTask) return;

    setIsSubmitting(true);
    const newDesc = progressText.trim();
    const newStatus = isMovingToProgress ? 'IN_PROGRESS' : progressModalTask.status;

    setTasks(prev => prev.map(t => 
      t.id === progressModalTask.id 
        ? { ...t, description: newDesc, status: newStatus } 
        : t
    ));

    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          description: newDesc,
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', progressModalTask.id);

      if (error) {
        alert('Gagal menyimpan progres tugas');
      } else {
        setProgressModalTask(null);
        setProgressText('');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderTaskCard = (task: Task) => {
    const isDone = task.status === 'DONE';
    const isProg = task.status === 'IN_PROGRESS';
    
    return (
      <div key={task.id} className={`bg-surface-bright border border-surface-variant rounded-[20px] p-4 shadow-[0_8px_24px_rgba(24,26,42,0.04)] transition-all ${isDone ? 'opacity-70' : ''}`}>
        <div className="flex justify-between items-start mb-3 gap-2">
          <h4 className={`font-bold text-sm line-clamp-2 flex-1 ${isDone ? 'text-secondary line-through' : 'text-on-surface'}`}>{task.title}</h4>
          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 ${priorityColor(task.priority)}`}>
            {task.priority || 'NONE'}
          </span>
        </div>

        {task.description && (
          <div className={`p-3 rounded-[12px] mb-3 text-xs border ${isProg ? 'bg-primary/5 border-primary/20' : 'bg-surface border-surface-variant'}`}>
            <span className={`font-bold block mb-1 ${isProg ? 'text-primary' : 'text-on-surface'}`}>
              {isProg ? '📌 Progres:' : 'Catatan:'}
            </span>
            <p className="text-secondary line-clamp-3">{task.description}</p>
          </div>
        )}

        {task.due_date && (
          <div className="flex items-center gap-1.5 text-xs font-medium text-secondary mb-4">
            <Clock className="w-3.5 h-3.5" />
            {format(new Date(task.due_date), 'dd MMM yy HH:mm', { locale: id })}
          </div>
        )}

        <div className="flex items-center gap-2 pt-3 border-t border-surface-variant justify-between">
          <div className="flex gap-2 flex-1">
            {task.status !== 'TODO' && (
               <button 
                onClick={() => updateStatus(task.id, task.status === 'DONE' ? 'IN_PROGRESS' : 'TODO')}
                className="flex items-center justify-center py-1.5 px-2 bg-surface-container hover:bg-surface-variant text-on-surface text-xs font-bold rounded-lg transition-colors"
               >
                 <ChevronLeft className="w-4 h-4" />
               </button>
            )}

            {isProg && (
              <button 
                onClick={() => handleOpenProgressModal(task, false)}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold rounded-lg transition-colors border border-primary/20"
              >
                <Edit3 className="w-3.5 h-3.5" /> Catat
              </button>
            )}

            {!isDone && (
              <button 
                onClick={() => {
                  if (task.status === 'TODO') handleOpenProgressModal(task, true);
                  else updateStatus(task.id, 'DONE');
                }}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 bg-surface-container hover:bg-surface-variant text-on-surface text-xs font-bold rounded-lg transition-colors"
              >
                Maju <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>

          <button onClick={() => deleteTask(task.id)} className="p-1.5 text-outline hover:text-danger hover:bg-error-container rounded-lg transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  const renderColumn = (title: string, columnTasks: Task[], icon: any, colorClass: string) => {
    const Icon = icon;
    return (
      <div className="w-[300px] shrink-0 h-full flex flex-col snap-center">
        <div className="flex items-center gap-2 mb-4 px-1 shrink-0">
          <Icon className={`w-5 h-5 ${colorClass}`} />
          <h2 className="text-sm font-bold text-on-surface">{title} <span className="text-secondary bg-surface-container px-2 py-0.5 rounded-full text-xs ml-1">{columnTasks.length}</span></h2>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-hide pb-20 px-1 flex flex-col gap-3">
          {columnTasks.map(renderTaskCard)}
          {columnTasks.length === 0 && (
             <div className="border-2 border-dashed border-surface-variant rounded-[20px] p-6 text-center text-secondary text-sm font-medium">
               Kosong
             </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="flex-1 w-full overflow-x-auto snap-x snap-mandatory scrollbar-hide px-5">
        <div className="flex gap-4 h-full min-w-max pb-4">
          {renderColumn('To Do', todo, LayoutList, 'text-secondary')}
          {renderColumn('In Progress', inProgress, Loader2, 'text-primary')}
          {renderColumn('Done', done, CheckCircle2, 'text-mint-fg')}
        </div>
      </div>

      {progressModalTask && (
        <Modal 
          isOpen={true} 
          onClose={() => setProgressModalTask(null)} 
          title={isMovingToProgress ? `Mulai Kerjakan` : `Update Progres`}
        >
          <form onSubmit={handleSaveProgress}>
            <div className="mb-4">
              <label className="block text-sm font-bold text-on-surface mb-2" htmlFor="progress_text">
                Prosesnya sudah sampai mana? <span className="text-danger">*</span>
              </label>
              <textarea 
                id="progress_text"
                required
                className="w-full bg-surface-bright border-2 border-surface-variant rounded-[16px] px-4 py-3.5 text-on-surface placeholder:text-outline focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-medium resize-none"
                rows={4}
                value={progressText}
                onChange={e => setProgressText(e.target.value)}
                placeholder="Ceritain progress kamu..."
              />
              <p className="text-[11px] text-secondary mt-2">
                Catatan ini akan tersimpan dan bisa kamu perbarui sewaktu-waktu.
              </p>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button 
                type="button" 
                onClick={() => setProgressModalTask(null)} 
                className="px-5 py-2.5 rounded-full font-bold text-on-surface hover:bg-surface-container transition-colors text-sm"
                disabled={isSubmitting}
              >
                Batal
              </button>
              <button 
                type="submit" 
                disabled={isSubmitting} 
                className="px-5 py-2.5 rounded-full font-bold bg-accent-gradient text-white shadow-[0_8px_16px_rgba(56,74,216,0.25)] transition-all active:scale-95 text-sm"
              >
                {isSubmitting ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
