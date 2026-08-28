'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { ChevronRight, ChevronLeft, Trash2, Edit3 } from 'lucide-react';
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
      case 'HIGH': return 'text-danger border-danger';
      case 'MEDIUM': return 'text-warning border-warning';
      case 'LOW': return 'text-success border-success';
      default: return 'text-secondary border-secondary';
    }
  };

  const updateStatus = async (taskId: string, newStatus: string) => {
    // Optimistic UI update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    
    // Update DB
    const { error } = await supabase
      .from('tasks')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', taskId);

    if (error) {
      console.error('Error updating task:', error);
      // Revert if error
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

    // Optimistic UI update
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
        console.error('Gagal update progres task:', error);
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
    return (
      <div key={task.id} className="task-card">
        <div className="task-header">
          <h3 className="font-medium text-sm">{task.title}</h3>
          <span className={`task-priority ${priorityColor(task.priority)}`}>
            {task.priority || 'NONE'}
          </span>
        </div>

        {/* Catatan / Progres Tugas */}
        {task.description && (
          <div 
            className="mt-2 p-2 rounded text-xs" 
            style={{ 
              backgroundColor: task.status === 'IN_PROGRESS' ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-secondary)', 
              borderLeft: task.status === 'IN_PROGRESS' ? '3px solid #3b82f6' : '3px solid var(--border-color)' 
            }}
          >
            <span className="font-semibold block mb-0.5" style={{ color: task.status === 'IN_PROGRESS' ? '#3b82f6' : 'var(--text-color)' }}>
              {task.status === 'IN_PROGRESS' ? '📌 Progres Saat Ini:' : 'Catatan:'}
            </span>
            <p className="text-secondary line-clamp-3">{task.description}</p>
          </div>
        )}

        {task.due_date && (
          <p className="text-xs text-secondary mt-3">
            Tenggat: {format(new Date(task.due_date), 'dd MMM yyyy HH:mm', { locale: id })}
          </p>
        )}
        
        {/* Tombol Aksi */}
        <div className="flex gap-2 mt-4 pt-3 border-t items-center justify-between" style={{ borderColor: 'var(--border-color)' }}>
          <div className="flex gap-2 flex-1 flex-wrap">
            {task.status !== 'TODO' && (
              <button 
                onClick={() => updateStatus(task.id, task.status === 'DONE' ? 'IN_PROGRESS' : 'TODO')}
                className="flex-1 min-w-[70px] flex items-center justify-center gap-1 py-1.5 px-2.5 text-xs font-semibold rounded cursor-pointer transition-colors"
                style={{
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-color)',
                  backgroundColor: 'var(--card-bg)'
                }}
              >
                <ChevronLeft size={14} /> Mundur
              </button>
            )}

            {/* Tombol Update Progres khusus di kolom IN_PROGRESS */}
            {task.status === 'IN_PROGRESS' && (
              <button 
                onClick={() => handleOpenProgressModal(task, false)}
                className="flex items-center justify-center gap-1 py-1.5 px-2.5 text-xs font-semibold rounded cursor-pointer transition-colors"
                style={{
                  border: '1px solid #3b82f6',
                  color: '#3b82f6',
                  backgroundColor: 'transparent'
                }}
                title="Perbarui catatan progres pengerjaan"
              >
                <Edit3 size={13} /> Update Progres
              </button>
            )}
            
            {task.status !== 'DONE' && (
              <button 
                onClick={() => {
                  if (task.status === 'TODO') {
                    // Masuk ke In Progress -> Wajibkan input progres
                    handleOpenProgressModal(task, true);
                  } else {
                    // Dari In Progress ke Done
                    updateStatus(task.id, 'DONE');
                  }
                }}
                className="flex-1 min-w-[70px] flex items-center justify-center gap-1 py-1.5 px-2.5 text-xs font-semibold rounded cursor-pointer transition-colors"
                style={{
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-color)',
                  backgroundColor: 'var(--card-bg)'
                }}
              >
                Maju <ChevronRight size={14} />
              </button>
            )}
          </div>

          <button
            onClick={() => deleteTask(task.id)}
            className="p-1 text-secondary hover:text-danger bg-transparent border-none cursor-pointer transition-colors ml-1"
            title="Hapus Tugas"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    );
  };

  const renderColumn = (title: string, columnTasks: Task[]) => (
    <div className="kanban-column card">
      <h2 className="text-lg font-semibold mb-4">{title} ({columnTasks.length})</h2>
      <div className="kanban-items">
        {columnTasks.map(renderTaskCard)}
        {columnTasks.length === 0 && (
          <p className="text-sm text-secondary text-center py-4">Tidak ada tugas</p>
        )}
      </div>
    </div>
  );

  return (
    <>
      <div className="kanban-board">
        {renderColumn('To Do', todo)}
        {renderColumn('In Progress', inProgress)}
        {renderColumn('Done', done)}
      </div>

      {/* Modal Input & Update Deskripsi Progres */}
      {progressModalTask && (
        <Modal 
          isOpen={true} 
          onClose={() => setProgressModalTask(null)} 
          title={isMovingToProgress ? `Mulai Kerjakan: ${progressModalTask.title}` : `Update Progres: ${progressModalTask.title}`}
        >
          <form onSubmit={handleSaveProgress}>
            <div className="form-group mb-4">
              <label className="form-label" htmlFor="progress_text">
                Prosesnya sudah sampai mana? <span className="text-danger">*</span>
              </label>
              <textarea 
                id="progress_text"
                required
                className="form-textarea w-full"
                rows={4}
                value={progressText}
                onChange={e => setProgressText(e.target.value)}
                placeholder="Contoh: Sudah selesai bab 1, sekarang sedang menyusun kuesioner..."
              />
              <p className="text-xs text-secondary mt-1">
                Catatan ini akan tersimpan dan bisa kamu perbarui sewaktu-waktu di kolom In Progress.
              </p>
            </div>

            <div className="form-actions flex justify-end gap-2">
              <button 
                type="button" 
                onClick={() => setProgressModalTask(null)} 
                className="btn btn-outline"
                disabled={isSubmitting}
              >
                Batal
              </button>
              <button 
                type="submit" 
                disabled={isSubmitting} 
                className="btn btn-primary"
              >
                {isSubmitting ? 'Menyimpan...' : (isMovingToProgress ? 'Simpan & Masuk In Progress' : 'Simpan Progres')}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
