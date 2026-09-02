'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

// ────────────────────────────────────────────────────────────────
// 1. Profil Pengguna
// ────────────────────────────────────────────────────────────────
export async function updateProfile(fullName: string) {
    const supabase = createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Tidak terautentikasi');

    const { error } = await supabase.auth.updateUser({
        data: { full_name: fullName.trim() }
    });

    if (error) throw error;
    revalidatePath('/settings');
    revalidatePath('/');
    return { success: true };
}

// ────────────────────────────────────────────────────────────────
// 2. Rutinitas Kerja & Seragam (work_routines)
// ────────────────────────────────────────────────────────────────
export async function updateWorkRoutines(
    uniformSchedule: Record<string, string>,
    storyReminderTime: string
) {
    const supabase = createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Tidak terautentikasi');

    // Cek apakah data work_routines sudah ada
    const { data: existing } = await supabase
        .from('work_routines')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

    if (existing) {
        const { error } = await supabase
            .from('work_routines')
            .update({
                uniform_schedule: uniformSchedule,
                story_reminder_time: storyReminderTime,
                updated_at: new Date().toISOString()
            })
            .eq('user_id', user.id);

        if (error) throw error;
    } else {
        const { error } = await supabase
            .from('work_routines')
            .insert({
                user_id: user.id,
                uniform_schedule: uniformSchedule,
                story_reminder_time: storyReminderTime
            });

        if (error) throw error;
    }

    revalidatePath('/settings');
    return { success: true };
}

// ────────────────────────────────────────────────────────────────
// 3. Manajemen Rekening Bank & Dompet (bank_accounts)
// ────────────────────────────────────────────────────────────────
export async function addBankAccount(name: string, initialBalance: number) {
    const supabase = createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Tidak terautentikasi');

    const { error } = await supabase.from('bank_accounts').insert({
        user_id: user.id,
        name: name.trim(),
        balance: Number(initialBalance) || 0,
        currency: 'IDR'
    });

    if (error) throw error;
    revalidatePath('/settings');
    revalidatePath('/finance');
    revalidatePath('/');
    return { success: true };
}

export async function updateBankAccount(id: string, name: string, balance: number) {
    const supabase = createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Tidak terautentikasi');

    const { error } = await supabase
        .from('bank_accounts')
        .update({
            name: name.trim(),
            balance: Number(balance),
            updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('user_id', user.id);

    if (error) throw error;
    revalidatePath('/settings');
    revalidatePath('/finance');
    revalidatePath('/');
    return { success: true };
}

export async function deleteBankAccount(id: string) {
    const supabase = createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Tidak terautentikasi');

    const { error } = await supabase
        .from('bank_accounts')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

    if (error) throw error;
    revalidatePath('/settings');
    revalidatePath('/finance');
    revalidatePath('/');
    return { success: true };
}

// ────────────────────────────────────────────────────────────────
// 4. Manajemen Kategori Transaksi (transaction_categories)
// ────────────────────────────────────────────────────────────────
export async function addCategory(name: string, type: 'income' | 'expense') {
    const supabase = createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Tidak terautentikasi');

    const { error } = await supabase.from('transaction_categories').insert({
        user_id: user.id,
        name: name.trim(),
        type: type
    });

    if (error) throw error;
    revalidatePath('/settings');
    revalidatePath('/finance');
    return { success: true };
}

export async function deleteCategory(id: string) {
    const supabase = createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Tidak terautentikasi');

    const { error } = await supabase
        .from('transaction_categories')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

    if (error) throw error;
    revalidatePath('/settings');
    revalidatePath('/finance');
    return { success: true };
}
