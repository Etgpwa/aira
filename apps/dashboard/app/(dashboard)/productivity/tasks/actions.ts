'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

// ────────────────────────────────────────────────────────────────
// 1. Tambah Tugas Baru (createTask)
// ────────────────────────────────────────────────────────────────
export async function createTask(data: {
    title: string;
    description?: string | null;
    priority?: 'HIGH' | 'MEDIUM' | 'LOW';
    category?: string | null;
    dueDate?: string | null;
    status?: 'TODO' | 'IN_PROGRESS' | 'DONE';
}) {
    const supabase = createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Tidak terautentikasi');

    if (!data.title?.trim()) throw new Error('Judul tugas harus diisi');

    const { data: newTask, error } = await supabase
        .from('tasks')
        .insert({
            user_id: user.id,
            title: data.title.trim(),
            description: data.description?.trim() || null,
            priority: data.priority || 'MEDIUM',
            category: data.category?.trim() || null,
            dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : null,
            status: data.status || 'TODO',
        })
        .select()
        .single();

    if (error) throw error;

    revalidatePath('/productivity/tasks');
    revalidatePath('/');
    return { success: true, task: newTask };
}

// ────────────────────────────────────────────────────────────────
// 2. Edit Tugas Lengkap (updateTask)
// ────────────────────────────────────────────────────────────────
export async function updateTask(data: {
    id: string;
    title: string;
    description?: string | null;
    priority?: 'HIGH' | 'MEDIUM' | 'LOW';
    category?: string | null;
    dueDate?: string | null;
    status?: 'TODO' | 'IN_PROGRESS' | 'DONE';
}) {
    const supabase = createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Tidak terautentikasi');

    if (!data.title?.trim()) throw new Error('Judul tugas harus diisi');

    const updatePayload: any = {
        title: data.title.trim(),
        description: data.description?.trim() || null,
        priority: data.priority || 'MEDIUM',
        category: data.category?.trim() || null,
        due_date: data.dueDate ? new Date(data.dueDate).toISOString() : null,
        updated_at: new Date().toISOString()
    };

    if (data.status) {
        updatePayload.status = data.status;
    }

    const { error } = await supabase
        .from('tasks')
        .update(updatePayload)
        .eq('id', data.id)
        .eq('user_id', user.id);

    if (error) throw error;

    revalidatePath('/productivity/tasks');
    revalidatePath('/');
    return { success: true };
}

// ────────────────────────────────────────────────────────────────
// 3. Update Status Tugas & Catatan Progress (updateTaskStatus)
// ────────────────────────────────────────────────────────────────
export async function updateTaskStatus(
    taskId: string,
    newStatus: 'TODO' | 'IN_PROGRESS' | 'DONE',
    description?: string | null
) {
    const supabase = createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Tidak terautentikasi');

    const updatePayload: any = {
        status: newStatus,
        updated_at: new Date().toISOString()
    };

    if (description !== undefined) {
        updatePayload.description = description?.trim() || null;
    }

    const { error } = await supabase
        .from('tasks')
        .update(updatePayload)
        .eq('id', taskId)
        .eq('user_id', user.id);

    if (error) throw error;

    revalidatePath('/productivity/tasks');
    revalidatePath('/');
    return { success: true };
}

// ────────────────────────────────────────────────────────────────
// 4. Hapus Tugas (deleteTask)
// ────────────────────────────────────────────────────────────────
export async function deleteTask(taskId: string) {
    const supabase = createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Tidak terautentikasi');

    const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId)
        .eq('user_id', user.id);

    if (error) throw error;

    revalidatePath('/productivity/tasks');
    revalidatePath('/');
    return { success: true };
}
