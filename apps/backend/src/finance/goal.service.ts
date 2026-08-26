import { supabase } from '../supabase/supabase.client';
import { normalizeIsoDate } from '../utils/date.utils';

export interface TopupGoalResult {
    goalName: string;
    addedAmount: number;
    currentAmount: number;
    targetAmount: number;
    percentage: number;
    status: 'IN_PROGRESS' | 'ACHIEVED';
    totalAccountBalance: number;
    totalAllocatedGoals: number;
    freeBalance: number;
    accounts: { name: string; balance: number }[];
    allGoals: { name: string; currentAmount: number; targetAmount: number; percentage: number }[];
}

export class GoalService {

    /**
     * Membuat target tabungan (Goal) baru
     */
    async createGoal(params: {
        userId: string;
        name: string;
        targetAmount: number;
        targetDate?: string | null;
        currency?: string;
    }) {
        // Cek apakah goal dengan nama yang sama sudah ada (biar tidak duplikat)
        const { data: existing } = await supabase
            .from('goals')
            .select('id, target_amount')
            .eq('user_id', params.userId)
            .ilike('name', params.name)
            .eq('status', 'IN_PROGRESS')
            .limit(1);

        if (existing && existing.length > 0) {
            const updatePayload: any = { updated_at: new Date().toISOString() };
            if (params.targetAmount) updatePayload.target_amount = params.targetAmount;
            if (params.targetDate) updatePayload.target_date = normalizeIsoDate(params.targetDate);

            const { error: upErr } = await supabase
                .from('goals')
                .update(updatePayload)
                .eq('id', existing[0].id);

            if (upErr) console.error("Gagal update goal:", upErr);
            return { name: params.name, targetAmount: params.targetAmount || existing[0].target_amount };
        }

        const { error } = await supabase
            .from('goals')
            .insert({
                user_id: params.userId,
                name: params.name,
                target_amount: params.targetAmount,
                current_amount: 0,
                currency: params.currency || 'IDR',
                target_date: normalizeIsoDate(params.targetDate),
                status: 'IN_PROGRESS'
            });

        if (error) {
            console.error("Gagal membuat goal baru:", error);
            throw error;
        }

        return {
            name: params.name,
            targetAmount: params.targetAmount
        };
    }

    /**
     * Menabung / Alokasi uang ke target Goal tertentu (Konsep Virtual Allocation)
     */
    async topupGoal(params: {
        userId: string;
        goalName: string;
        amount: number;
    }): Promise<TopupGoalResult | null> {
        // 1. Cari goal aktif berdasarkan nama
        const { data: goal } = await supabase
            .from('goals')
            .select('*')
            .eq('user_id', params.userId)
            .ilike('name', `%${params.goalName}%`)
            .eq('status', 'IN_PROGRESS')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (!goal) {
            console.warn(`Goal dengan nama "${params.goalName}" tidak ditemukan.`);
            return null;
        }

        const currentAmount = Number(goal.current_amount || 0);
        const targetAmount = Number(goal.target_amount);
        const newCurrentAmount = currentAmount + params.amount;
        const percentage = Math.round((newCurrentAmount / targetAmount) * 100);

        let newStatus: 'IN_PROGRESS' | 'ACHIEVED' = 'IN_PROGRESS';
        if (newCurrentAmount >= targetAmount) {
            newStatus = 'ACHIEVED';
        }

        // 2. Update goal
        const { error: updateErr } = await supabase
            .from('goals')
            .update({
                current_amount: newCurrentAmount,
                status: newStatus,
                updated_at: new Date().toISOString()
            })
            .eq('id', goal.id);

        if (updateErr) {
            console.error("Gagal update topup goal:", updateErr);
            throw updateErr;
        }

        // 3. Hitung Total Saldo Riil per Rekening
        const { data: accountsRaw } = await supabase
            .from('bank_accounts')
            .select('name, balance')
            .eq('user_id', params.userId);

        const accountsList = (accountsRaw || []).map(a => ({ name: a.name, balance: Number(a.balance || 0) }));
        const totalAccountBalance = accountsList.reduce((sum, a) => sum + a.balance, 0);

        // 4. Semua goal aktif (untuk hitung alokasi & tampilkan rincian)
        const { data: allGoalsRaw } = await supabase
            .from('goals')
            .select('name, current_amount, target_amount')
            .eq('user_id', params.userId)
            .eq('status', 'IN_PROGRESS');

        const allGoalsList = (allGoalsRaw || []).map(g => ({
            name: g.name,
            currentAmount: Number(g.current_amount || 0),
            targetAmount: Number(g.target_amount),
            percentage: Math.round((Number(g.current_amount || 0) / Number(g.target_amount)) * 100)
        }));

        const totalAllocatedGoals = allGoalsList.reduce((sum, g) => sum + g.currentAmount, 0);
        const freeBalance = totalAccountBalance - totalAllocatedGoals;

        return {
            goalName: goal.name,
            addedAmount: params.amount,
            currentAmount: newCurrentAmount,
            targetAmount,
            percentage,
            status: newStatus,
            totalAccountBalance,
            totalAllocatedGoals,
            freeBalance: freeBalance < 0 ? 0 : freeBalance,
            accounts: accountsList,
            allGoals: allGoalsList
        };
    }

    /**
     * Menghapus goal berdasarkan nama
     */
    async deleteGoal(userId: string, goalName: string): Promise<string | null> {
        const { data: goal } = await supabase
            .from('goals')
            .select('id, name')
            .eq('user_id', userId)
            .ilike('name', `%${goalName}%`)
            .limit(1);

        if (!goal || goal.length === 0) return null;

        const { error } = await supabase.from('goals').delete().eq('id', goal[0].id);
        if (error) {
            console.error("Gagal hapus goal:", error);
            return null;
        }
        return goal[0].name;
    }
}

export const goalService = new GoalService();
