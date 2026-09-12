'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Edit2, Trash2, X, Check, Save } from 'lucide-react';
import { editHabitLog, deleteHabitLog } from '../actions';

interface HabitLog {
  id: string;
  habit_type: string;
  custom_label: string | null;
  logged_at: string;
  duration_minutes: number | null;
  notes: string | null;
  source: string;
}

export default function HabitLogHistory({ logs, labelMap }: { logs: HabitLog[], labelMap: Record<string, string> }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<{ duration_minutes: string, notes: string, logged_at: string }>({
    duration_minutes: '',
    notes: '',
    logged_at: ''
  });
  const [isSaving, setIsSaving] = useState(false);

  const startEdit = (log: HabitLog) => {
    setEditingId(log.id);
    setEditData({
      duration_minutes: log.duration_minutes ? log.duration_minutes.toString() : '',
      notes: log.notes || '',
      // format to datetime-local expected string YYYY-MM-DDThh:mm
      logged_at: new Date(log.logged_at).toISOString().slice(0, 16)
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleSave = async (id: string) => {
    setIsSaving(true);
    try {
      await editHabitLog(id, {
        duration_minutes: editData.duration_minutes ? parseInt(editData.duration_minutes) : null,
        notes: editData.notes || null,
        logged_at: new Date(editData.logged_at).toISOString(),
      });
      setEditingId(null);
    } catch (error) {
      alert('Gagal menyimpan perubahan');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Yakin ingin menghapus log ini?')) {
      try {
        await deleteHabitLog(id);
      } catch (error) {
        alert('Gagal menghapus log');
      }
    }
  };

  return (
    <div>
      <h2 className="text-lg font-bold text-on-surface mb-4">Riwayat Log</h2>
      
      <div className="bg-surface-bright border border-surface-variant rounded-[20px] shadow-sm overflow-hidden">
        {logs.length === 0 ? (
          <p className="text-sm text-secondary text-center py-6">Belum ada riwayat.</p>
        ) : (
          <div className="divide-y divide-surface-variant">
            {logs.map(log => (
              <div key={log.id} className="p-4 hover:bg-surface-container-low transition-colors">
                {editingId === log.id ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-on-surface text-sm">{labelMap[log.habit_type] || log.habit_type}</span>
                      <div className="flex gap-2">
                        <button onClick={() => cancelEdit()} className="p-1 text-secondary hover:text-on-surface hover:bg-surface-variant rounded-full transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleSave(log.id)} disabled={isSaving} className="p-1 text-primary hover:bg-primary/10 rounded-full transition-colors">
                          <Save className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-[10px] font-bold text-secondary uppercase tracking-wider block mb-1">Waktu</label>
                      <input 
                        type="datetime-local" 
                        value={editData.logged_at} 
                        onChange={(e) => setEditData({...editData, logged_at: e.target.value})}
                        className="w-full bg-surface border border-surface-variant rounded-xl px-3 py-2 text-sm text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-secondary uppercase tracking-wider block mb-1">Durasi (Menit)</label>
                      <input 
                        type="number" 
                        value={editData.duration_minutes} 
                        onChange={(e) => setEditData({...editData, duration_minutes: e.target.value})}
                        placeholder="Opsional"
                        className="w-full bg-surface border border-surface-variant rounded-xl px-3 py-2 text-sm text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-secondary uppercase tracking-wider block mb-1">Catatan</label>
                      <input 
                        type="text" 
                        value={editData.notes} 
                        onChange={(e) => setEditData({...editData, notes: e.target.value})}
                        placeholder="Opsional"
                        className="w-full bg-surface border border-surface-variant rounded-xl px-3 py-2 text-sm text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between items-center gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-on-surface text-sm truncate">
                        {labelMap[log.habit_type] || log.habit_type}
                        {log.custom_label && <span className="font-normal text-secondary ml-1">({log.custom_label})</span>}
                      </p>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-secondary">
                        <span className="font-medium">{format(new Date(log.logged_at), "dd MMM yyyy, HH:mm", { locale: id })}</span>
                        {log.duration_minutes && <span className="text-primary font-medium">{log.duration_minutes} mnt</span>}
                        {log.source && <span className="opacity-60">via {log.source}</span>}
                      </div>
                      {log.notes && <p className="text-xs text-secondary mt-1">{log.notes}</p>}
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => startEdit(log)} className="p-2 text-secondary hover:text-primary hover:bg-primary/10 rounded-full transition-colors" title="Edit">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(log.id)} className="p-2 text-secondary hover:text-danger hover:bg-danger/10 rounded-full transition-colors" title="Hapus">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
