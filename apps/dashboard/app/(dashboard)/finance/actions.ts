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

// ────────────────────────────────────────────────────────────────
// 4. Ambil Data Rekap Bulanan untuk Ekspor (Excel & PDF Jurnal)
// ────────────────────────────────────────────────────────────────
export async function getMonthlyFinanceRecap(month: number, year: number, accountId?: string) {
    const supabase = createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Tidak terautentikasi');

    // Rentang waktu bulan bersangkutan
    const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0)).toISOString();
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)).toISOString();

    let query = supabase
        .from('transactions')
        .select(`
            id,
            amount,
            currency,
            type,
            description,
            transaction_date,
            created_at,
            account_id,
            category_id,
            bank_accounts (id, name),
            transaction_categories (id, name)
        `)
        .eq('user_id', user.id)
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate)
        .order('transaction_date', { ascending: true }); // ASC untuk alur jurnal akuntansi kronologis

    if (accountId && accountId !== 'all') {
        query = query.eq('account_id', accountId);
    }

    const { data: transactions, error: txError } = await query;
    if (txError) throw txError;

    // Ambil daftar rekening dan profil pengguna
    const [accountsRes, profileRes] = await Promise.all([
        supabase.from('bank_accounts').select('id, name, balance').eq('user_id', user.id),
        supabase.from('user_settings').select('phone_number, default_currency, timezone').eq('user_id', user.id).maybeSingle(),
    ]);

    return {
        month,
        year,
        transactions: transactions || [],
        accounts: accountsRes.data || [],
        userSettings: profileRes.data || null,
        userEmail: user.email || '',
    };
}

// ────────────────────────────────────────────────────────────────
// 5. Catat Utang / Piutang Manual
// ────────────────────────────────────────────────────────────────
export async function recordDebtManual(data: {
    personName: string;
    type: 'PAYABLE' | 'RECEIVABLE';
    amount: number;
    accountId: string;
    description?: string;
    noWalletImpact: boolean;
}) {
    const supabase = createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Tidak terautentikasi');

    const numAmount = Number(data.amount);
    if (!numAmount || numAmount <= 0) throw new Error('Nominal harus lebih dari 0');
    if (!data.personName.trim()) throw new Error('Nama orang harus diisi');

    // Cek akun bank
    let account = null;
    if (!data.noWalletImpact && data.accountId) {
        const { data: acc, error: accError } = await supabase
            .from('bank_accounts')
            .select('*')
            .eq('id', data.accountId)
            .eq('user_id', user.id)
            .single();
        if (accError || !acc) throw new Error('Rekening tidak ditemukan');
        account = acc;
    }

    // 1. Insert ke tabel debts (tanpa kolom wallet_impact_on_creation, kita catat di deskripsi untuk marking opsional)
    const extraDesc = data.noWalletImpact ? ' [Administratif]' : '';
    const finalDesc = (data.description || '') + extraDesc;

    const { data: debtData, error: debtError } = await supabase
        .from('debts')
        .insert({
            user_id: user.id,
            person_name: data.personName.trim(),
            type: data.type,
            amount: numAmount,
            remaining_amount: numAmount,
            currency: account?.currency || 'IDR',
            status: 'UNPAID',
            description: finalDesc.trim() || null
        })
        .select()
        .single();

    if (debtError) throw debtError;

    // 2. Jika berdampak ke wallet, buat transaksi
    if (!data.noWalletImpact && account) {
        // PAYABLE (Kita ngutang) -> Uang Masuk ke kita (Income)
        // RECEIVABLE (Kita meminjamkan uang) -> Uang Keluar dari kita (Expense)
        const txType = data.type === 'PAYABLE' ? 'income' : 'expense';
        
        await supabase.from('transactions').insert({
            user_id: user.id,
            account_id: account.id,
            amount: numAmount,
            currency: account.currency || 'IDR',
            original_amount: numAmount,
            type: txType,
            description: `Pencatatan ${data.type === 'PAYABLE' ? 'Hutang dari' : 'Piutang ke'} ${data.personName.trim()}`,
            transaction_date: new Date().toISOString()
        });

        const currentBalance = Number(account.balance || 0);
        const newBalance = txType === 'income' ? currentBalance + numAmount : currentBalance - numAmount;
        await supabase.from('bank_accounts').update({ balance: newBalance, updated_at: new Date().toISOString() }).eq('id', account.id);
    }

    revalidatePath('/finance');
    return { success: true };
}

// ────────────────────────────────────────────────────────────────
// 6. Pelunasan Utang / Piutang Manual (Multiselect)
// ────────────────────────────────────────────────────────────────
export async function payDebtManual(data: {
    personName: string;
    debtIds: string[];
    amount: number;
    accountId: string;
    isSettled: boolean; // Jika true, selisih dihapus/dijadikan tip
}) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Tidak terautentikasi');

    const amount = Number(data.amount);
    if (amount < 0) throw new Error('Nominal tidak valid');

    // 1. Ambil debts yang dipilih
    const { data: debtsToPay, error: debtsErr } = await supabase
        .from('debts')
        .select('*')
        .in('id', data.debtIds)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true }); // FIFO

    if (debtsErr || !debtsToPay || debtsToPay.length === 0) throw new Error('Utang tidak ditemukan');

    const totalSelectedDebt = debtsToPay.reduce((sum, d) => sum + Number(d.remaining_amount), 0);
    const debtType = debtsToPay[0].type; // Asumsi semua yg dipilih tipenya sama

    // 2. Alokasikan pembayaran
    let remainingPayment = amount;
    
    for (const debt of debtsToPay) {
        if (remainingPayment <= 0 && !data.isSettled) break;

        const currentRemaining = Number(debt.remaining_amount);
        
        if (currentRemaining <= remainingPayment) {
            // Lunas natural
            remainingPayment -= currentRemaining;
            await supabase.from('debts').update({
                remaining_amount: 0,
                status: 'PAID',
                updated_at: new Date().toISOString()
            }).eq('id', debt.id);
        } else {
            // Bayar parsial
            if (data.isSettled) {
                // Dianggap lunas (selisih diikhlaskan)
                await supabase.from('debts').update({
                    remaining_amount: 0,
                    status: 'PAID',
                    updated_at: new Date().toISOString()
                }).eq('id', debt.id);
                remainingPayment = 0; // stop since it's settled
            } else {
                // Sisa normal
                const newRemaining = currentRemaining - remainingPayment;
                remainingPayment = 0;
                await supabase.from('debts').update({
                    remaining_amount: newRemaining,
                    status: 'PARTIAL',
                    updated_at: new Date().toISOString()
                }).eq('id', debt.id);
            }
        }
    }

    // Jika ada sisa pembayaran dan isSettled (Tip)
    const excessPayment = remainingPayment;

    // 3. Catat di transaksi & Update Wallet (Hanya nilai actual amount yg dibayar)
    if (data.accountId && amount > 0) {
        const { data: acc } = await supabase.from('bank_accounts').select('*').eq('id', data.accountId).single();
        if (acc) {
            // Saat melunasi RECEIVABLE (Piutang) -> Uang kembali ke kita (Income)
            // Saat melunasi PAYABLE (Utang) -> Uang keluar dari kita (Expense)
            const txType = debtType === 'RECEIVABLE' ? 'income' : 'expense';

            // Pembayaran utama
            await supabase.from('transactions').insert({
                user_id: user.id,
                account_id: acc.id,
                amount: amount,
                currency: acc.currency || 'IDR',
                original_amount: amount,
                type: txType,
                description: `Pelunasan ${debtType === 'PAYABLE' ? 'Hutang ke' : 'Piutang dari'} ${data.personName}`,
                transaction_date: new Date().toISOString()
            });

            const currentBalance = Number(acc.balance || 0);
            const newBalance = txType === 'income' ? currentBalance + amount : currentBalance - amount;
            await supabase.from('bank_accounts').update({ balance: newBalance, updated_at: new Date().toISOString() }).eq('id', acc.id);
        }
    }

    revalidatePath('/finance');
    return { success: true, excessPayment, totalSelectedDebt };
}

// ────────────────────────────────────────────────────────────────
// 7. Hapus Utang (Dengan Verifikasi Password)
// ────────────────────────────────────────────────────────────────
export async function deleteDebtManual(debtId: string, passwordInput: string) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !user.email) throw new Error('Tidak terautentikasi');

    // 1. Verifikasi Password (menggunakan signInWithPassword bawaan Supabase auth)
    // NOTE: ini memerlukan email, asumsinya signIn mengandalkan email/password. 
    // Di PWA ini jika login pakai magic link / OTP, mungkin tidak ada password. 
    // Tapi karena user minta 'masukan password', kita coba panggil signInWithPassword.
    const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: passwordInput,
    });

    if (signInError) {
        throw new Error('Password salah atau tidak valid');
    }

    // 2. Hapus
    const { error } = await supabase.from('debts').delete().eq('id', debtId).eq('user_id', user.id);
    if (error) throw error;

    revalidatePath('/finance');
    return { success: true };
}
