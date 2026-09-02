'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

// ────────────────────────────────────────────────────────────────
// 1. Buat Pengingat Kustom Baru (createCustomReminder)
// ────────────────────────────────────────────────────────────────
export async function createCustomReminder(data: {
    message: string;
    remindAt: string; // ISO String atau local datetime-local
    taskId?: string | null;
}) {
    const supabase = createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Tidak terautentikasi');

    if (!data.message?.trim()) throw new Error('Pesan pengingat harus diisi');
    if (!data.remindAt) throw new Error('Waktu pengingat harus diisi');

    const remindDate = new Date(data.remindAt);
    if (isNaN(remindDate.getTime())) {
        throw new Error('Format waktu pengingat tidak valid');
    }

    const { data: newReminder, error } = await supabase
        .from('reminders')
        .insert({
            user_id: user.id,
            message: data.message.trim(),
            remind_at: remindDate.toISOString(),
            task_id: data.taskId || null,
            status: 'PENDING'
        })
        .select()
        .single();

    if (error) throw error;

    revalidatePath('/');
    revalidatePath('/productivity/tasks');
    return { success: true, reminder: newReminder };
}

// ────────────────────────────────────────────────────────────────
// 2. Reschedule Pengingat (rescheduleReminder)
// ────────────────────────────────────────────────────────────────
export async function rescheduleReminder(reminderId: string, newRemindAt: string) {
    const supabase = createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Tidak terautentikasi');

    if (!newRemindAt) throw new Error('Waktu baru pengingat harus diisi');

    const remindDate = new Date(newRemindAt);
    if (isNaN(remindDate.getTime())) {
        throw new Error('Format waktu pengingat tidak valid');
    }

    const { error } = await supabase
        .from('reminders')
        .update({
            remind_at: remindDate.toISOString(),
            status: 'PENDING',
            updated_at: new Date().toISOString()
        })
        .eq('id', reminderId)
        .eq('user_id', user.id);

    if (error) throw error;

    revalidatePath('/');
    revalidatePath('/productivity/tasks');
    return { success: true };
}

// ────────────────────────────────────────────────────────────────
// 3. Hapus / Batal Pengingat (deleteReminder)
// ────────────────────────────────────────────────────────────────
export async function deleteReminder(reminderId: string) {
    const supabase = createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Tidak terautentikasi');

    const { error } = await supabase
        .from('reminders')
        .delete()
        .eq('id', reminderId)
        .eq('user_id', user.id);

    if (error) throw error;

    revalidatePath('/');
    revalidatePath('/productivity/tasks');
    return { success: true };
}

// ────────────────────────────────────────────────────────────────
// 4. Update Pengaturan Rutinitas / Briefing & Story IG (updateRoutineSettings)
// ────────────────────────────────────────────────────────────────
export async function updateRoutineSettings(data: {
    storyReminderTime?: string; // Format "HH:mm" atau "HH:mm:ss"
}) {
    const supabase = createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Tidak terautentikasi');

    if (data.storyReminderTime) {
        const timeFormatted = data.storyReminderTime.length === 5 ? `${data.storyReminderTime}:00` : data.storyReminderTime;
        
        const { error } = await supabase
            .from('work_routines')
            .upsert({
                user_id: user.id,
                story_reminder_time: timeFormatted,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });

        if (error) throw error;
    }

    revalidatePath('/');
    revalidatePath('/settings');
    return { success: true };
}
