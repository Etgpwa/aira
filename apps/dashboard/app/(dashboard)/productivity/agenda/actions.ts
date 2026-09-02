'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

// ────────────────────────────────────────────────────────────────
// 1. Tambah Jadwal Baru (createSchedule)
// ────────────────────────────────────────────────────────────────
export async function createSchedule(data: {
    subject: string;
    dayOfWeek: number; // 0 = Minggu, 1 = Senin, ..., 6 = Sabtu
    startTime: string; // Format "HH:mm" atau "HH:mm:ss"
    endTime: string;   // Format "HH:mm" atau "HH:mm:ss"
}) {
    const supabase = createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Tidak terautentikasi');

    if (!data.subject?.trim()) throw new Error('Nama kegiatan/mata kuliah harus diisi');
    if (!data.startTime || !data.endTime) throw new Error('Jam mulai dan jam selesai harus diisi');

    // Format waktu menjadi HH:mm:00 jika belum
    const formattedStartTime = data.startTime.length === 5 ? `${data.startTime}:00` : data.startTime;
    const formattedEndTime = data.endTime.length === 5 ? `${data.endTime}:00` : data.endTime;

    const { data: newSchedule, error } = await supabase
        .from('study_schedules')
        .insert({
            user_id: user.id,
            subject: data.subject.trim(),
            day_of_week: data.dayOfWeek,
            start_time: formattedStartTime,
            end_time: formattedEndTime
        })
        .select()
        .single();

    if (error) throw error;

    revalidatePath('/productivity/agenda');
    revalidatePath('/');
    return { success: true, schedule: newSchedule };
}

// ────────────────────────────────────────────────────────────────
// 2. Edit Jadwal (updateSchedule)
// ────────────────────────────────────────────────────────────────
export async function updateSchedule(data: {
    id: string;
    subject: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
}) {
    const supabase = createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Tidak terautentikasi');

    if (!data.subject?.trim()) throw new Error('Nama kegiatan/mata kuliah harus diisi');
    if (!data.startTime || !data.endTime) throw new Error('Jam mulai dan jam selesai harus diisi');

    const formattedStartTime = data.startTime.length === 5 ? `${data.startTime}:00` : data.startTime;
    const formattedEndTime = data.endTime.length === 5 ? `${data.endTime}:00` : data.endTime;

    const { error } = await supabase
        .from('study_schedules')
        .update({
            subject: data.subject.trim(),
            day_of_week: data.dayOfWeek,
            start_time: formattedStartTime,
            end_time: formattedEndTime
        })
        .eq('id', data.id)
        .eq('user_id', user.id);

    if (error) throw error;

    revalidatePath('/productivity/agenda');
    revalidatePath('/');
    return { success: true };
}

// ────────────────────────────────────────────────────────────────
// 3. Hapus Jadwal (deleteSchedule)
// ────────────────────────────────────────────────────────────────
export async function deleteSchedule(scheduleId: string) {
    const supabase = createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Tidak terautentikasi');

    const { error } = await supabase
        .from('study_schedules')
        .delete()
        .eq('id', scheduleId)
        .eq('user_id', user.id);

    if (error) throw error;

    revalidatePath('/productivity/agenda');
    revalidatePath('/');
    return { success: true };
}
