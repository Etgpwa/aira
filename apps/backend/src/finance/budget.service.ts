import { supabase } from '../supabase/supabase.client';
import { transactionService } from './transaction.service';

export class BudgetService {

    /**
     * Atur budget untuk kategori tertentu pada bulan & tahun berjalan.
     */
    async setBudget(params: {
        userId: string;
        categoryName: string;
        amount: number;
    }): Promise<{ categoryName: string; amount: number }> {
        const now = new Date();
        const month = now.getMonth() + 1; // 1 - 12
        const year = now.getFullYear();

        // 1. Dapatkan atau buat kategori (type = expense)
        const categoryId = await transactionService.getCategoryIdByName(
            params.userId,
            params.categoryName,
            'expense'
        );

        if (!categoryId) {
            throw new Error("Gagal memproses kategori pengeluaran.");
        }

        // 2. Cek apakah budget untuk kategori ini pada bulan/tahun ini sudah ada
        const { data: existingBudget } = await supabase
            .from('budgets')
            .select('id')
            .eq('user_id', params.userId)
            .eq('category_id', categoryId)
            .eq('month', month)
            .eq('year', year)
            .single();

        if (existingBudget?.id) {
            // Update
            const { error: updateErr } = await supabase
                .from('budgets')
                .update({ amount: params.amount })
                .eq('id', existingBudget.id);

            if (updateErr) throw updateErr;
        } else {
            // Insert baru
            const { error: insertErr } = await supabase
                .from('budgets')
                .insert({
                    user_id: params.userId,
                    category_id: categoryId,
                    amount: params.amount,
                    month,
                    year
                });

            if (insertErr) throw insertErr;
        }

        return {
            categoryName: params.categoryName,
            amount: params.amount
        };
    }

    /**
     * Mengecek apakah pengeluaran baru mendekati atau melebihi budget limit bulan ini.
     */
    async checkBudgetWarning(params: {
        userId: string;
        categoryName: string | null;
    }): Promise<string | null> {
        if (!params.categoryName) return null;

        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();

        // 1. Cari categoryId
        const { data: category } = await supabase
            .from('transaction_categories')
            .select('id, name')
            .eq('user_id', params.userId)
            .ilike('name', params.categoryName)
            .eq('type', 'expense')
            .single();

        if (!category) return null;

        // 2. Cari budget limit kategori bulan ini
        const { data: budget } = await supabase
            .from('budgets')
            .select('amount')
            .eq('user_id', params.userId)
            .eq('category_id', category.id)
            .eq('month', month)
            .eq('year', year)
            .single();

        if (!budget || !budget.amount || Number(budget.amount) <= 0) {
            return null; // Belum ada budget set untuk kategori ini
        }

        const budgetLimit = Number(budget.amount);

        // 3. Hitung akumulasi pengeluaran bulan ini untuk kategori tersebut
        const firstDayOfMonth = new Date(year, month - 1, 1).toISOString();
        const lastDayOfMonth = new Date(year, month, 0, 23, 59, 59).toISOString();

        const { data: transactions } = await supabase
            .from('transactions')
            .select('amount')
            .eq('user_id', params.userId)
            .eq('category_id', category.id)
            .eq('type', 'expense')
            .gte('transaction_date', firstDayOfMonth)
            .lte('transaction_date', lastDayOfMonth);

        const totalSpent = (transactions || []).reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
        const percentage = Math.round((totalSpent / budgetLimit) * 100);
        const remaining = budgetLimit - totalSpent;

        const formattedSpent = totalSpent.toLocaleString('id-ID');
        const formattedLimit = budgetLimit.toLocaleString('id-ID');
        const formattedRemaining = Math.abs(remaining).toLocaleString('id-ID');

        // 4. Susun pesan peringatan berdasarkan threshold
        if (percentage >= 100) {
            return `\n\n❌ *PERINGATAN OVERBUDGET!* 🚨\nBudget *${category.name}* bulan ini sudah terlampaui ${percentage}%!\nTerpakai: Rp ${formattedSpent} / Rp ${formattedLimit}\nOver: Rp ${formattedRemaining}`;
        } else if (percentage >= 95) {
            return `\n\n🚨 *BUDGET KRITIS (${percentage}%)!*\nBudget *${category.name}* hampir habis!\nTerpakai: Rp ${formattedSpent} / Rp ${formattedLimit}\nSisa: Rp ${formattedRemaining}`;
        } else if (percentage >= 80) {
            return `\n\n⚠️ *PERINGATAN BUDGET (${percentage}%)*\nBudget *${category.name}* sudah terpakai cukup banyak.\nTerpakai: Rp ${formattedSpent} / Rp ${formattedLimit}\nSisa: Rp ${formattedRemaining}`;
        }

        return null;
    }
}

export const budgetService = new BudgetService();
