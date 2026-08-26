'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import Modal from './Modal';
import { createClient } from '@/lib/supabase/client';

// Supabase client will be created inside the component

export default function AddScheduleModal({ userId }: { userId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const [formData, setFormData] = useState({
    title: '',
    day_of_week: '1',
    start_time: '',
    end_time: '',
    location: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      let start = formData.start_time;
      if (start.length === 5) start += ":00";
      let end = formData.end_time;
      if (end.length === 5) end += ":00";

      const { error } = await supabase.from('study_schedules').insert({
        user_id: userId,
        subject: formData.title,
        day_of_week: Number(formData.day_of_week),
        start_time: start,
        end_time: end
      });

      if (!error) {
        setIsOpen(false);
        setFormData({ title: '', day_of_week: '1', start_time: '', end_time: '', location: '' });
        router.refresh();
      } else {
        console.error(error);
        alert('Gagal menyimpan jadwal');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button onClick={() => setIsOpen(true)} className="btn btn-primary">
        <Plus size={16} className="mr-2" style={{ marginRight: '0.5rem' }} />
        Tambah Jadwal
      </button>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Tambah Jadwal">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="title">Kegiatan/Matkul</label>
            <input 
              type="text" 
              id="title" 
              required 
              className="form-input" 
              value={formData.title} 
              onChange={e => setFormData({ ...formData, title: e.target.value })} 
              placeholder="Contoh: Algoritma Pemrograman"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="day">Hari</label>
            <select 
              id="day" 
              className="form-select"
              value={formData.day_of_week}
              onChange={e => setFormData({ ...formData, day_of_week: e.target.value })}
            >
              <option value="1">Senin</option>
              <option value="2">Selasa</option>
              <option value="3">Rabu</option>
              <option value="4">Kamis</option>
              <option value="5">Jumat</option>
              <option value="6">Sabtu</option>
              <option value="0">Minggu</option>
            </select>
          </div>
          
          <div className="flex gap-4">
            <div className="form-group flex-1">
              <label className="form-label" htmlFor="start_time">Mulai</label>
              <input 
                type="time" 
                id="start_time" 
                required 
                className="form-input" 
                value={formData.start_time} 
                onChange={e => setFormData({ ...formData, start_time: e.target.value })} 
              />
            </div>
            <div className="form-group flex-1">
              <label className="form-label" htmlFor="end_time">Selesai</label>
              <input 
                type="time" 
                id="end_time" 
                required 
                className="form-input" 
                value={formData.end_time} 
                onChange={e => setFormData({ ...formData, end_time: e.target.value })} 
              />
            </div>
          </div>
          
          <div className="form-group">
            <label className="form-label" htmlFor="location">Lokasi (Opsional)</label>
            <input 
              type="text" 
              id="location" 
              className="form-input" 
              value={formData.location} 
              onChange={e => setFormData({ ...formData, location: e.target.value })} 
              placeholder="Gedung A, Ruang 102"
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
