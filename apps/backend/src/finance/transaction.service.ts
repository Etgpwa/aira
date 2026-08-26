import { supabase } from '../supabase/supabase.client';
import { currencyService } from './currency.service';

export interface RecordTransactionResult {
    success: boolean;
    originalAmount: number;
    originalCurrency: string;
    finalAmount: number;
    accountCurrency: string;
    converted: boolean;
    newBalance: number;
}

export class TransactionService {
    
    /**
     * Dapatkan Account ID berdasarkan nama akun (misal: 'BCA', 'GoPay')
     * Jika tidak ditemukan, akan mencoba mengembalikan akun default (Cash).
     */
    async getAccountByName(userId: string, accountName: string | null): Promise<{id: string, name: string, currency: string} | null> {
        const targetName = accountName || 'Cash';

        const { data } = await supabase
            .from('bank_accounts')
            .select('id, name, currency')
            .eq('user_id', userId)
            .ilike('name', targetName)
            .limit(1);
        
        if (data && data.length > 0) return { id: data[0].id, name: data[0].name, currency: data[0].currency };

        // Jika akun belum ada (misal: Cash atau BNI), otomatis buatkan
        const { data: newAcc, error } = await supabase
            .from('bank_accounts')
            .insert({
                user_id: userId,
                name: targetName,
                currency: 'IDR',
                balance: 0
            })
            .select('id, name, currency')
            .single();

        if (error) {
            console.error("Gagal buat akun baru:", error);
            return null;
        }
        
        return { id: newAcc.id, name: newAcc.name, currency: newAcc.currency };
    }

    /**
     * Dapatkan Category ID berdasarkan nama. Buat baru jika belum ada.
     */
    async getCategoryIdByName(userId: string, categoryName: string, type: 'income' | 'expense'): Promise<string | null> {
        if (!categoryName) return null;

        const { data } = await supabase
            .from('transaction_categories')
            .select('id')
            .eq('user_id', userId)
            .ilike('name', categoryName)
            .eq('type', type)
            .single();
        
        if (data?.id) return data.id;

        // Buat kategori baru
        const { data: newCat, error } = await supabase
            .from('transaction_categories')
            .insert({
                user_id: userId,
                name: categoryName,
                type: type
            })
            .select('id')
            .single();
            
        if (error) {
            console.error("Gagal buat kategori baru:", error);
            return null;
        }

        return newCat.id;
    }

    /**
     * Mencatat transaksi (pengeluaran / pemasukan) dengan auto konversi mata uang
     */
    async recordTransaction(params: {
        userId: string;
        type: 'income' | 'expense';
        amount: number;
        currency: string;
        accountName: string | null;
        categoryName: string | null;
        description: string | null;
    }): Promise<RecordTransactionResult> {
        const account = await this.getAccountByName(params.userId, params.accountName);
        if (!account) throw new Error("Gagal menemukan/membuat bank_account");

        const categoryId = params.categoryName 
            ? await this.getCategoryIdByName(params.userId, params.categoryName, params.type)
            : null;

        // 1. Konversi mata uang jika berbeda dengan akun tujuan
        const originalAmount = params.amount;
        const originalCurrency = params.currency.toUpperCase();
        let finalAmount = originalAmount;
        let converted = false;

        if (originalCurrency !== account.currency.toUpperCase()) {
            finalAmount = await currencyService.convert(originalAmount, originalCurrency, account.currency);
            converted = true;
            console.log(`💱 Konversi Otomatis: ${originalAmount} ${originalCurrency} -> ${finalAmount} ${account.currency}`);
        }

        // 2. Insert ke tabel transactions
        const { error: txError } = await supabase
            .from('transactions')
            .insert({
                user_id: params.userId,
                account_id: account.id,
                category_id: categoryId,
                amount: finalAmount,             // Nilai yg masuk/keluar dr rekening
                currency: originalCurrency,      // Mata uang asli transaksi
                original_amount: originalAmount, // Nilai asli transaksi
                type: params.type,
                description: params.description,
                transaction_date: new Date().toISOString()
            });

        if (txError) {
            console.error("Gagal insert transaksi:", txError);
            throw txError;
        }

        // 3. Update saldo (balance) di bank_accounts
        const { data: accData } = await supabase
            .from('bank_accounts')
            .select('balance')
            .eq('id', account.id)
            .single();
            
        const currentBalance = Number(accData?.balance || 0);
        const newBalance = params.type === 'income' 
            ? currentBalance + finalAmount 
            : currentBalance - finalAmount;

        const { error: updateErr } = await supabase
            .from('bank_accounts')
            .update({ balance: newBalance })
            .eq('id', account.id);

        if (updateErr) {
            console.error("Gagal update balance:", updateErr);
            throw updateErr;
        }

        return {
            success: true,
            originalAmount,
            originalCurrency,
            finalAmount,
            accountCurrency: account.currency.toUpperCase(),
            converted,
            newBalance
        };
    }

    /**
     * Set / Update saldo awal rekening secara langsung
     */
    async setAccountBalance(userId: string, accountName: string, newBalance: number): Promise<boolean> {
        const account = await this.getAccountByName(userId, accountName);
        if (!account) throw new Error("Gagal menemukan/membuat bank_account");

        const { error } = await supabase
            .from('bank_accounts')
            .update({ balance: newBalance, updated_at: new Date().toISOString() })
            .eq('id', account.id);

        if (error) {
            console.error("Gagal set account balance:", error);
            throw error;
        }

        return true;
    }
}

export const transactionService = new TransactionService();
