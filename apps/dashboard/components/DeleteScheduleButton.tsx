'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function DeleteScheduleButton({ scheduleId, subject }: { scheduleId: string; subject: string }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleDelete = async () => {
    if (!confirm(`Hapus jadwal "${subject}"?`)) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase.from('study_schedules').delete().eq('id', scheduleId);
      if (!error) {
        router.refresh();
      } else {
        alert('Gagal menghapus jadwal');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <button 
      onClick={handleDelete} 
      disabled={isDeleting}
      className="p-1 text-secondary hover:text-danger transition-colors border-none bg-transparent cursor-pointer ml-2"
      title="Hapus Jadwal"
    >
      <Trash2 size={14} />
    </button>
  );
}
