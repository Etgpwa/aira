'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

// ────────────────────────────────────────────────────────────────
// 1. Catat Transaksi Manual (Pemasukan / Pengeluaran)
// ────────────────────────────────────────────────────────────────
export async function recordTransaction(data: {
    type: 'income' | 'expense';
    amount: number;
    accountId: string;
    categoryId?: string | null;
    description?: string | null;
    transactionDate?: string;
}) {
    const supabase = createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Tidak terautentikasi');

    const numAmount = Number(data.amount);
    if (!numAmount || numAmount <= 0) throw new Error('Nominal transaksi harus lebih dari 0');
    if (!data.accountId) throw new Error('Pilih rekening / dompet');

    // 1. Cek akun bank
    const { data: account, error: accError } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('id', data.accountId)
        .eq('user_id', user.id)
        .single();

    if (accError || !account) throw new Error('Rekening tidak ditemukan');

    const txDate = data.transactionDate ? new Date(data.transactionDate).toISOString() : new Date().toISOString();

    // 2. Insert ke transactions
    const { data: tx, error: txError } = await supabase
        .from('transactions')
        .insert({
            user_id: user.id,
            account_id: data.accountId,
            category_id: data.categoryId || null,
            amount: numAmount,
            currency: account.currency || 'IDR',
            original_amount: numAmount,
            type: data.type,
            description: data.description?.trim() || null,
            transaction_date: txDate,
        })
        .select()
        .single();

    if (txError) throw txError;

    // 3. Update saldo akun bank
    const currentBalance = Number(account.balance || 0);
    const newBalance = data.type === 'income'
        ? currentBalance + numAmount
        : currentBalance - numAmount;

    const { error: updateAccError } = await supabase
        .from('bank_accounts')
        .update({
            balance: newBalance,
            updated_at: new Date().toISOString()
        })
        .eq('id', data.accountId)
        .eq('user_id', user.id);

    if (updateAccError) throw updateAccError;

    revalidatePath('/finance');
    revalidatePath('/');
    return { success: true, transaction: tx };
}

// ────────────────────────────────────────────────────────────────
// 2. Batalkan / Hapus Transaksi (Rollback & Kembalikan Saldo)
// ────────────────────────────────────────────────────────────────
export async function deleteTransaction(transactionId: string) {
    const supabase = createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Tidak terautentikasi');

    // 1. Ambil data transaksi yang akan dibatalkan
    const { data: tx, error: txError } = await supabase
        .from('transactions')
        .select('*, bank_accounts(id, balance)')
        .eq('id', transactionId)
        .eq('user_id', user.id)
        .single();

    if (txError || !tx) throw new Error('Transaksi tidak ditemukan');

    // 2. Kembalikan saldo ke rekening terkait
    const account = Array.isArray(tx.bank_accounts) ? tx.bank_accounts[0] : tx.bank_accounts;
    if (account) {
        const currentBalance = Number(account.balance || 0);
        const amount = Number(tx.amount || 0);
        // Jika tadinya expense (uang keluar), maka saat dibatalkan saldo bertambah
        // Jika tadinya income (uang masuk), maka saat dibatalkan saldo berkurang
        const revertedBalance = tx.type === 'expense'
            ? currentBalance + amount
            : currentBalance - amount;

        const { error: accUpdateError } = await supabase
            .from('bank_accounts')
            .update({
                balance: revertedBalance,
                updated_at: new Date().toISOString()
            })
            .eq('id', account.id)
            .eq('user_id', user.id);

        if (accUpdateError) throw accUpdateError;
    }

    // 3. Hapus baris transaksi
    const { error: deleteError } = await supabase
        .from('transactions')
        .delete()
        .eq('id', transactionId)
        .eq('user_id', user.id);

    if (deleteError) throw deleteError;

    revalidatePath('/finance');
    revalidatePath('/');
    return { success: true };
}

// ────────────────────────────────────────────────────────────────
// 3. Batalkan Transaksi Terakhir (Instant Cancel)
// ────────────────────────────────────────────────────────────────
export async function cancelLastTransaction() {
    const supabase = createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Tidak terautentikasi');

    // Ambil transaksi terbaru dalam 24 jam terakhir
    const { data: txs, error: txError } = await supabase
        .from('transactions')
        .select('id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

    if (txError || !txs || txs.length === 0) {
        throw new Error('Tidak ada transaksi terbaru untuk dibatalkan');
    }

    return await deleteTransaction(txs[0].id);
}
