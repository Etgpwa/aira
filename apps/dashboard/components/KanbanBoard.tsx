'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { ChevronRight, ChevronLeft, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type Task = any;

export default function KanbanBoard({ initialTasks }: { initialTasks: Task[] }) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
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
      .update({ status: newStatus })
      .eq('id', taskId);

    if (error) {
      console.error('Error updating task:', error);
      // Revert if error
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: prev.find(pt => pt.id === taskId)?.status } : t));
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
        {task.description && (
          <p className="text-sm text-secondary mt-2 line-clamp-2">{task.description}</p>
        )}
        {task.due_date && (
          <p className="text-xs text-secondary mt-4">
            Tenggat: {format(new Date(task.due_date), 'dd MMM yyyy HH:mm', { locale: id })}
          </p>
        )}
        
        {/* Actions */}
        <div className="flex gap-2 mt-4 pt-3 border-t items-center justify-between" style={{ borderColor: 'var(--border-color)' }}>
          <div className="flex gap-2 flex-1">
            {task.status !== 'TODO' && (
              <button 
                onClick={() => updateStatus(task.id, task.status === 'DONE' ? 'IN_PROGRESS' : 'TODO')}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 px-3 text-xs font-semibold rounded cursor-pointer transition-colors"
                style={{
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-color)',
                  backgroundColor: 'var(--card-bg)'
                }}
              >
                <ChevronLeft size={14} /> Mundur
              </button>
            )}
            
            {task.status !== 'DONE' && (
              <button 
                onClick={() => updateStatus(task.id, task.status === 'TODO' ? 'IN_PROGRESS' : 'DONE')}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 px-3 text-xs font-semibold rounded cursor-pointer transition-colors"
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
    <div className="kanban-board">
      {renderColumn('To Do', todo)}
      {renderColumn('In Progress', inProgress)}
      {renderColumn('Done', done)}
    </div>
  );
}
