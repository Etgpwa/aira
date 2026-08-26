'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import Modal from './Modal';
import { createClient } from '@/lib/supabase/client';

// Supabase client will be created inside the component

export default function AddTaskModal({ userId }: { userId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'MEDIUM',
    due_date: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const { error } = await supabase.from('tasks').insert({
        user_id: userId,
        title: formData.title,
        description: formData.description || null,
        priority: formData.priority,
        status: 'TODO',
        due_date: formData.due_date ? new Date(formData.due_date).toISOString() : null
      });

      if (!error) {
        setIsOpen(false);
        setFormData({ title: '', description: '', priority: 'MEDIUM', due_date: '' });
        router.refresh();
      } else {
        console.error(error);
        alert('Gagal menyimpan tugas');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button onClick={() => setIsOpen(true)} className="btn btn-primary">
        <Plus size={16} className="mr-2" style={{ marginRight: '0.5rem' }} />
        Tugas Baru
      </button>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Buat Tugas Baru">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="title">Judul Tugas</label>
            <input 
              type="text" 
              id="title" 
              required 
              className="form-input" 
              value={formData.title} 
              onChange={e => setFormData({ ...formData, title: e.target.value })} 
              placeholder="Contoh: Beli Token Listrik"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="description">Deskripsi (Opsional)</label>
            <textarea 
              id="description" 
              className="form-textarea" 
              value={formData.description} 
              onChange={e => setFormData({ ...formData, description: e.target.value })} 
              placeholder="Catatan tambahan..."
              rows={3}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="priority">Prioritas</label>
            <select 
              id="priority" 
              className="form-select"
              value={formData.priority}
              onChange={e => setFormData({ ...formData, priority: e.target.value })}
            >
              <option value="HIGH">Tinggi (High)</option>
              <option value="MEDIUM">Sedang (Medium)</option>
              <option value="LOW">Rendah (Low)</option>
            </select>
          </div>
          
          <div className="form-group">
            <label className="form-label" htmlFor="due_date">Tenggat Waktu (Opsional)</label>
            <input 
              type="datetime-local" 
              id="due_date" 
              className="form-input" 
              value={formData.due_date} 
              onChange={e => setFormData({ ...formData, due_date: e.target.value })} 
            />
          </div>

          <div className="form-actions">
            <button type="button" onClick={() => setIsOpen(false)} className="btn btn-outline">Batal</button>
            <button type="submit" disabled={isSubmitting} className="btn btn-primary">
              {isSubmitting ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
