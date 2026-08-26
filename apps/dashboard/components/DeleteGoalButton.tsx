'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function DeleteGoalButton({ goalId, goalName }: { goalId: string; goalName: string }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleDelete = async () => {
    if (!confirm(`Yakin ingin menghapus target tabungan "${goalName}"?`)) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase.from('goals').delete().eq('id', goalId);
      if (!error) {
        router.refresh();
      } else {
        alert('Gagal menghapus target tabungan');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <button 
      onClick={handleDelete} 
      disabled={isDeleting}
      className="p-1 text-secondary hover:text-danger transition-colors border-none bg-transparent cursor-pointer"
      title="Hapus Target"
    >
      <Trash2 size={16} />
    </button>
  );
}
