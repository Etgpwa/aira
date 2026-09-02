'use client';

import { useState, useTransition } from 'react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import {
  ChevronRight,
  ChevronLeft,
  Trash2,
  Edit2,
  Clock,
  LayoutList,
  Loader2,
  CheckCircle2,
  Plus,
  StickyNote,
  Tag
} from 'lucide-react';
import { updateTaskStatus, deleteTask } from '@/app/(dashboard)/productivity/tasks/actions';
import AddTaskModal from '@/app/(dashboard)/productivity/tasks/components/AddTaskModal';
import EditTaskModal from '@/app/(dashboard)/productivity/tasks/components/EditTaskModal';
import Modal from './Modal';

type Task = {
  id: string;
  title: string;
  description?: string | null;
  priority?: 'HIGH' | 'MEDIUM' | 'LOW';
  category?: string | null;
  due_date?: string | null;
  status: 'TODO' | 'IN_PROGRESS' | 'DONE';
  created_at?: string;
  updated_at?: string;
};

export default function KanbanBoard({ initialTasks }: { initialTasks: Task[] }) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [progressModalTask, setProgressModalTask] = useState<Task | null>(null);
  const [progressText, setProgressText] = useState('');
  const [isMovingToProgress, setIsMovingToProgress] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Sinkronkan state jika initialTasks berubah (misal setelah router.refresh/server action)
  if (JSON.stringify(initialTasks) !== JSON.stringify(tasks) && !isPending && !isSubmitting) {
    setTasks(initialTasks);
  }

  const handleDeleteTask = (taskId: string, title: string) => {
    if (!confirm(`Hapus tugas "${title}"?`)) return;

    setTasks(prev => prev.filter(t => t.id !== taskId));
    startTransition(async () => {
      try {
        await deleteTask(taskId);
      } catch (err: any) {
        alert(err?.message || 'Gagal menghapus tugas');
        setTasks(initialTasks);
      }
    });
  };

  const handleUpdateStatus = (taskId: string, newStatus: 'TODO' | 'IN_PROGRESS' | 'DONE') => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    startTransition(async () => {
      try {
        await updateTaskStatus(taskId, newStatus);
      } catch (err: any) {
        console.error('Error updating status:', err);
        setTasks(initialTasks);
      }
    });
  };

  const handleOpenProgressModal = (task: Task, movingFromTodo: boolean) => {
    setProgressModalTask(task);
    setProgressText(task.description || '');
    setIsMovingToProgress(movingFromTodo);
  };

  const handleSaveProgress = (e: React.FormEvent) => {
    e.preventDefault();
    if (!progressModalTask) return;

    setIsSubmitting(true);
    const newDesc = progressText.trim();
    const newStatus: 'TODO' | 'IN_PROGRESS' | 'DONE' = isMovingToProgress ? 'IN_PROGRESS' : progressModalTask.status;

    setTasks(prev => prev.map(t =>
      t.id === progressModalTask.id
        ? { ...t, description: newDesc, status: newStatus }
        : t
    ));

    startTransition(async () => {
      try {
        await updateTaskStatus(progressModalTask.id, newStatus, newDesc);
        setProgressModalTask(null);
        setProgressText('');
      } catch (err: any) {
        alert(err?.message || 'Gagal menyimpan catatan progres');
        setTasks(initialTasks);
      } finally {
        setIsSubmitting(false);
      }
    });
  };

  const priorityBadge = (priority?: string) => {
    switch (priority) {
      case 'HIGH':
        return <span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-peach-bg text-peach-fg">Tinggi</span>;
      case 'MEDIUM':
        return <span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-warning/20 text-warning">Sedang</span>;
      case 'LOW':
        return <span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-mint-bg text-mint-fg">Rendah</span>;
      default:
        return null;
    }
  };

  const todo = tasks.filter(t => t.status === 'TODO');
  const inProgress = tasks.filter(t => t.status === 'IN_PROGRESS');
  const done = tasks.filter(t => t.status === 'DONE');

  const renderTaskCard = (task: Task) => {
    const isDone = task.status === 'DONE';
    const isProg = task.status === 'IN_PROGRESS';

    return (
      <div
        key={task.id}
        className={`bg-surface-bright border border-surface-variant rounded-[20px] p-4 shadow-[0_8px_24px_rgba(24,26,42,0.04)] transition-all flex flex-col justify-between ${isDone ? 'opacity-70' : ''}`}
      >
        <div>
          {/* Header Card: Judul + Prioritas + Aksi Edit */}
          <div className="flex justify-between items-start mb-2 gap-2">
            <h4 className={`font-bold text-sm line-clamp-2 flex-1 ${isDone ? 'text-secondary line-through' : 'text-on-surface'}`}>
              {task.title}
            </h4>

            <div className="flex items-center gap-1.5 shrink-0">
              {priorityBadge(task.priority)}
              <button
                onClick={() => setEditingTask(task)}
                className="w-6 h-6 rounded-md hover:bg-surface-container flex items-center justify-center text-secondary hover:text-primary transition-colors"
                title="Edit Tugas Lengkap"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Kategori jika ada */}
          {task.category && (
            <div className="flex items-center gap-1 text-[11px] font-semibold text-secondary mb-2">
              <Tag className="w-3 h-3 text-primary" /> {task.category}
            </div>
          )}

          {/* Catatan / Detail Progres */}
          {task.description && (
            <div className={`p-2.5 rounded-[12px] mb-3 text-xs border ${isProg ? 'bg-primary/5 border-primary/20' : 'bg-surface border-surface-variant'}`}>
              <span className={`font-bold block mb-1 text-[11px] ${isProg ? 'text-primary' : 'text-on-surface'}`}>
                {isProg ? '📌 Catatan Progres:' : 'Catatan:'}
              </span>
              <p className="text-secondary line-clamp-3 leading-relaxed whitespace-pre-line">{task.description}</p>
            </div>
          )}

          {/* Tenggat Waktu / Due Date */}
          {task.due_date && (
            <div className="flex items-center gap-1.5 text-xs font-medium text-secondary mb-3">
              <Clock className="w-3.5 h-3.5 text-primary" />
              {format(new Date(task.due_date), 'dd MMM yyyy, HH:mm', { locale: id })}
            </div>
          )}
        </div>

        {/* Footer Card: Tombol Navigasi Status & Hapus */}
        <div className="flex items-center gap-2 pt-3 border-t border-surface-variant justify-between mt-1">
          <div className="flex items-center gap-1.5 flex-1">
            {/* Tombol Mundur */}
            {task.status !== 'TODO' && (
              <button
                onClick={() => handleUpdateStatus(task.id, task.status === 'DONE' ? 'IN_PROGRESS' : 'TODO')}
                className="py-1.5 px-2 bg-surface-container hover:bg-surface-variant text-on-surface text-xs font-bold rounded-lg transition-colors flex items-center justify-center"
                title="Kembalikan status"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}

            {/* Tombol Catat Progres (khusus IN_PROGRESS) */}
            {isProg && (
              <button
                onClick={() => handleOpenProgressModal(task, false)}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold rounded-lg transition-colors border border-primary/20"
                title="Update Catatan Progres"
              >
                <StickyNote className="w-3.5 h-3.5" /> Catat
              </button>
            )}

            {/* Tombol Maju */}
            {!isDone && (
              <button
                onClick={() => {
                  if (task.status === 'TODO') handleOpenProgressModal(task, true);
                  else handleUpdateStatus(task.id, 'DONE');
                }}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 bg-surface-container hover:bg-surface-variant text-on-surface text-xs font-bold rounded-lg transition-colors"
              >
                {task.status === 'TODO' ? 'Mulai' : 'Selesai'} <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Tombol Hapus */}
          <button
            onClick={() => handleDeleteTask(task.id, task.title)}
            className="p-1.5 text-secondary hover:text-danger hover:bg-red-50 rounded-lg transition-colors"
            title="Hapus Tugas"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  const renderColumn = (title: string, columnTasks: Task[], icon: any, colorClass: string, isTodoColumn: boolean = false) => {
    const Icon = icon;
    return (
      <div className="w-[310px] shrink-0 h-full flex flex-col snap-center">
        {/* Header Kolom */}
        <div className="flex items-center justify-between mb-4 px-1 shrink-0">
          <div className="flex items-center gap-2">
            <Icon className={`w-5 h-5 ${colorClass}`} />
            <h2 className="text-sm font-bold text-on-surface">
              {title} <span className="text-secondary bg-surface-container px-2 py-0.5 rounded-full text-xs ml-1">{columnTasks.length}</span>
            </h2>
          </div>

          {isTodoColumn && (
            <AddTaskModal
              triggerButton={
                <button className="text-xs font-bold text-primary hover:text-primary-container flex items-center gap-1 bg-surface-container hover:bg-surface-container-high px-2.5 py-1 rounded-full transition-colors">
                  <Plus className="w-3.5 h-3.5" /> Tambah
                </button>
              }
            />
          )}
        </div>

        {/* List Tugas dalam Kolom */}
        <div className="flex-1 overflow-y-auto scrollbar-hide pb-20 px-1 flex flex-col gap-3">
          {columnTasks.map(renderTaskCard)}

          {columnTasks.length === 0 && (
            <div className="border-2 border-dashed border-surface-variant rounded-[20px] p-8 text-center text-secondary text-sm font-medium flex flex-col items-center justify-center gap-2">
              <p>Kosong</p>
              {isTodoColumn && (
                <AddTaskModal
                  triggerButton={
                    <button className="text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-full flex items-center gap-1 mt-1 transition-colors">
                      <Plus className="w-3.5 h-3.5" /> Buat Tugas Baru
                    </button>
                  }
                />
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="flex-1 w-full overflow-x-auto snap-x snap-mandatory scrollbar-hide px-5">
        <div className="flex gap-5 h-full min-w-max pb-4">
          {renderColumn('To Do', todo, LayoutList, 'text-secondary', true)}
          {renderColumn('In Progress', inProgress, Loader2, 'text-primary')}
          {renderColumn('Done', done, CheckCircle2, 'text-mint-fg')}
        </div>
      </div>

      {/* Modal Catat Progres Saat Pindah ke IN_PROGRESS */}
      {progressModalTask && (
        <Modal
          isOpen={true}
          onClose={() => setProgressModalTask(null)}
          title={isMovingToProgress ? `Mulai Kerjakan Tugas` : `Update Catatan Progres`}
        >
          <form onSubmit={handleSaveProgress}>
            <div className="mb-4">
              <p className="text-xs font-bold text-primary mb-2">
                📌 {progressModalTask.title}
              </p>
              <label className="block text-xs font-bold text-secondary mb-2" htmlFor="progress_text">
                Prosesnya sudah sampai mana? <span className="text-danger">*</span>
              </label>
              <textarea
                id="progress_text"
                required
                className="w-full bg-surface-bright border border-surface-variant rounded-[16px] px-4 py-3 text-on-surface placeholder:text-secondary focus:outline-none focus:border-primary transition-all font-medium resize-none text-sm"
                rows={4}
                value={progressText}
                onChange={e => setProgressText(e.target.value)}
                placeholder="Contoh: Sudah selesai draft 1, tinggal cek referensi..."
              />
              <p className="text-[11px] text-secondary mt-1.5">
                Catatan ini akan tersimpan di kartu tugas dan disinkronkan ke asisten Karen.
              </p>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setProgressModalTask(null)}
                className="px-5 py-2.5 rounded-full font-bold text-secondary hover:bg-surface-container transition-colors text-sm"
                disabled={isSubmitting}
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-full font-bold bg-primary hover:bg-primary-container text-on-primary shadow-[0_4px_16px_rgba(56,74,216,0.25)] transition-all active:scale-95 text-sm flex items-center gap-1.5"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4" /> Simpan</>}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal Edit Tugas Lengkap */}
      {editingTask && (
        <EditTaskModal
          task={editingTask}
          isOpen={true}
          onClose={() => setEditingTask(null)}
        />
      )}
    </>
  );
}
