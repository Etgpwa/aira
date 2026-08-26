'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import Modal from './Modal';
import { createClient } from '@/lib/supabase/client';

// Supabase client will be created inside the component

export default function AddGoalModal({ userId }: { userId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const [formData, setFormData] = useState({
    name: '',
    target_amount: '',
    deadline: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const { error } = await supabase.from('goals').insert({
        user_id: userId,
        name: formData.name,
        target_amount: Number(formData.target_amount),
        current_amount: 0,
        target_date: formData.deadline || null,
        status: 'IN_PROGRESS'
      });

      if (!error) {
        setIsOpen(false);
        setFormData({ name: '', target_amount: '', deadline: '' });
        router.refresh();
      } else {
        console.error(error);
        alert('Gagal menyimpan target tabungan');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button onClick={() => setIsOpen(true)} className="btn btn-primary">
        <Plus size={16} className="mr-2" style={{ marginRight: '0.5rem' }} />
        Buat Target
      </button>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Buat Target Tabungan">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="name">Nama Target</label>
            <input 
              type="text" 
              id="name" 
              required 
              className="form-input" 
              value={formData.name} 
              onChange={e => setFormData({ ...formData, name: e.target.value })} 
              placeholder="Beli Laptop Baru"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="target_amount">Nominal Target (Rp)</label>
            <input 
              type="number" 
              id="target_amount" 
              required 
              min="1"
              className="form-input" 
              value={formData.target_amount} 
              onChange={e => setFormData({ ...formData, target_amount: e.target.value })} 
              placeholder="Contoh: 15000000"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="deadline">Target Waktu (Opsional)</label>
            <input 
              type="date" 
              id="deadline" 
              className="form-input" 
              value={formData.deadline} 
              onChange={e => setFormData({ ...formData, deadline: e.target.value })} 
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
