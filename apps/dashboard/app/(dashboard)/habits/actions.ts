'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function addHabitLog(data: {
  habit_type: string;
  logged_at: string;
  duration_minutes?: number | null;
  notes?: string | null;
  custom_label?: string | null;
}) {
  const supabase = createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error('Tidak terautentikasi');

  const { error } = await supabase
    .from('habit_logs')
    .insert({
      user_id: user.id,
      habit_type: data.habit_type,
      logged_at: data.logged_at,
      duration_minutes: data.duration_minutes || null,
      notes: data.notes?.trim() || null,
      custom_label: data.custom_label?.trim() || null,
      source: 'PWA'
    });

  if (error) {
    console.error('Add habit error:', error);
    throw new Error('Gagal menambah log habit');
  }

  revalidatePath('/habits');
}

export async function editHabitLog(
  id: string, 
  data: {
    duration_minutes?: number | null;
    notes?: string | null;
    custom_label?: string | null;
    logged_at?: string;
  }
) {
  const supabase = createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error('Tidak terautentikasi');

  const { error } = await supabase
    .from('habit_logs')
    .update({
      duration_minutes: data.duration_minutes !== undefined ? data.duration_minutes : undefined,
      notes: data.notes !== undefined ? data.notes : undefined,
      custom_label: data.custom_label !== undefined ? data.custom_label : undefined,
      logged_at: data.logged_at !== undefined ? data.logged_at : undefined,
    })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.error('Edit habit error:', error);
    throw new Error('Gagal mengubah log habit');
  }

  revalidatePath('/habits');
}

export async function deleteHabitLog(id: string) {
  const supabase = createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error('Tidak terautentikasi');

  const { error } = await supabase
    .from('habit_logs')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.error('Delete habit error:', error);
    throw new Error('Gagal menghapus log habit');
  }

  revalidatePath('/habits');
}
