'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

// ────────────────────────────────────────────────────────────────
// 1. Buat Target Tabungan Baru (createGoal)
// ────────────────────────────────────────────────────────────────
export async function createGoal(data: {
    name: string;
    targetAmount: number;
    initialAmount?: number;
    targetDate?: string | null;
    sourceAccountId?: string | null;
}) {
    const supabase = createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Tidak terautentikasi');

    const targetAmt = Number(data.targetAmount);
    const initialAmt = Number(data.initialAmount || 0);

    if (!data.name.trim()) throw new Error('Nama target tabungan harus diisi');
    if (targetAmt <= 0) throw new Error('Target nominal harus lebih dari 0');

    // 1. Insert ke tabel goals
    const isAchieved = initialAmt >= targetAmt;
    const { data: newGoal, error: goalError } = await supabase
        .from('goals')
        .insert({
            user_id: user.id,
            name: data.name.trim(),
            target_amount: targetAmt,
            current_amount: initialAmt,
            currency: 'IDR',
            target_date: data.targetDate ? new Date(data.targetDate).toISOString() : null,
            status: isAchieved ? 'ACHIEVED' : 'IN_PROGRESS'
        })
        .select()
        .single();

    if (goalError) throw goalError;

    // 2. Jika ada setoran awal dan rekening sumber dipilih, potong saldo rekening & catat transaksi
    if (initialAmt > 0 && data.sourceAccountId) {
        const { data: acc } = await supabase
            .from('bank_accounts')
            .select('balance, name')
            .eq('id', data.sourceAccountId)
            .eq('user_id', user.id)
            .single();

        if (acc) {
            const currentBal = Number(acc.balance || 0);
            await supabase
                .from('bank_accounts')
                .update({
                    balance: currentBal - initialAmt,
                    updated_at: new Date().toISOString()
                })
                .eq('id', data.sourceAccountId);

            // Catat pengeluaran alokasi tabungan
            await supabase.from('transactions').insert({
                user_id: user.id,
                account_id: data.sourceAccountId,
                amount: initialAmt,
                currency: 'IDR',
                original_amount: initialAmt,
                type: 'expense',
                description: `Setoran Awal Tabungan: ${data.name.trim()}`,
                transaction_date: new Date().toISOString()
            });
        }
    }

    revalidatePath('/finance/goals');
    revalidatePath('/finance');
    revalidatePath('/');
    return { success: true, goal: newGoal };
}

// ────────────────────────────────────────────────────────────────
// 2. Edit Target Tabungan (updateGoal)
// ────────────────────────────────────────────────────────────────
export async function updateGoal(data: {
    id: string;
    name: string;
    targetAmount: number;
    targetDate?: string | null;
}) {
    const supabase = createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Tidak terautentikasi');

    const targetAmt = Number(data.targetAmount);
    if (!data.name.trim()) throw new Error('Nama target tabungan harus diisi');
    if (targetAmt <= 0) throw new Error('Target nominal harus lebih dari 0');

    // Cek current amount
    const { data: currentGoal } = await supabase
        .from('goals')
        .select('current_amount')
        .eq('id', data.id)
        .eq('user_id', user.id)
        .single();

    const currentAmt = Number(currentGoal?.current_amount || 0);
    const status = currentAmt >= targetAmt ? 'ACHIEVED' : 'IN_PROGRESS';

    const { error } = await supabase
        .from('goals')
        .update({
            name: data.name.trim(),
            target_amount: targetAmt,
            target_date: data.targetDate ? new Date(data.targetDate).toISOString() : null,
            status,
            updated_at: new Date().toISOString()
        })
        .eq('id', data.id)
        .eq('user_id', user.id);

    if (error) throw error;

    revalidatePath('/finance/goals');
    revalidatePath('/finance');
    return { success: true };
}

// ────────────────────────────────────────────────────────────────
// 3. Top Up / Setor Tabungan (topupGoal)
// ────────────────────────────────────────────────────────────────
export async function topupGoal(data: {
    id: string;
    amount: number;
    sourceAccountId?: string | null;
}) {
    const supabase = createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Tidak terautentikasi');

    const topupAmt = Number(data.amount);
    if (topupAmt <= 0) throw new Error('Nominal setor harus lebih dari 0');

    // 1. Ambil data goal
    const { data: goal, error: goalErr } = await supabase
        .from('goals')
        .select('*')
        .eq('id', data.id)
        .eq('user_id', user.id)
        .single();

    if (goalErr || !goal) throw new Error('Target tabungan tidak ditemukan');

    const newCurrentAmount = Number(goal.current_amount || 0) + topupAmt;
    const isAchieved = newCurrentAmount >= Number(goal.target_amount);

    // 2. Update saldo goal
    const { error: updateGoalErr } = await supabase
        .from('goals')
        .update({
            current_amount: newCurrentAmount,
            status: isAchieved ? 'ACHIEVED' : 'IN_PROGRESS',
            updated_at: new Date().toISOString()
        })
        .eq('id', data.id)
        .eq('user_id', user.id);

    if (updateGoalErr) throw updateGoalErr;

    // 3. Jika dipilih rekening sumber, potong saldo rekening & catat transaksi
    if (data.sourceAccountId) {
        const { data: acc } = await supabase
            .from('bank_accounts')
            .select('balance, name')
            .eq('id', data.sourceAccountId)
            .eq('user_id', user.id)
            .single();

        if (acc) {
            const currentBal = Number(acc.balance || 0);
            await supabase
                .from('bank_accounts')
                .update({
                    balance: currentBal - topupAmt,
                    updated_at: new Date().toISOString()
                })
                .eq('id', data.sourceAccountId);

            // Catat pengeluaran
            await supabase.from('transactions').insert({
                user_id: user.id,
                account_id: data.sourceAccountId,
                amount: topupAmt,
                currency: 'IDR',
                original_amount: topupAmt,
                type: 'expense',
                description: `Topup Tabungan: ${goal.name}`,
                transaction_date: new Date().toISOString()
            });
        }
    }

    revalidatePath('/finance/goals');
    revalidatePath('/finance');
    revalidatePath('/');
    return { success: true };
}

// ────────────────────────────────────────────────────────────────
// 4. Hapus Target Tabungan (deleteGoal)
// ────────────────────────────────────────────────────────────────
export async function deleteGoal(goalId: string) {
    const supabase = createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Tidak terautentikasi');

    const { error } = await supabase
        .from('goals')
        .delete()
        .eq('id', goalId)
        .eq('user_id', user.id);

    if (error) throw error;

    revalidatePath('/finance/goals');
    revalidatePath('/finance');
    revalidatePath('/');
    return { success: true };
}
