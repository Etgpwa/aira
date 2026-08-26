import { supabase } from '../supabase/supabase.client';

export interface PayDebtResult {
    personName: string;
    paidAmount: number;
    remainingAmount: number;
    status: 'PAID' | 'PARTIAL';
    debtType: 'PAYABLE' | 'RECEIVABLE';
}

export class DebtService {

    /**
     * Mencatat hutang atau piutang baru.
     * PAYABLE: Uang yang kamu pinjam dari orang (Hutangku)
     * RECEIVABLE: Uang milikmu yang dipinjam orang lain (Piutangku)
     */
    async recordDebt(params: {
        userId: string;
        personName: string;
        type: 'PAYABLE' | 'RECEIVABLE';
        amount: number;
        currency?: string;
        description?: string | null;
    }) {
        const { error } = await supabase
            .from('debts')
            .insert({
                user_id: params.userId,
                person_name: params.personName,
                type: params.type,
                amount: params.amount,
                remaining_amount: params.amount,
                currency: params.currency || 'IDR',
                status: 'UNPAID',
                description: params.description || null
            });

        if (error) {
            console.error("Gagal mencatat hutang/piutang:", error);
            throw error;
        }

        return {
            personName: params.personName,
            type: params.type,
            amount: params.amount
        };
    }

    /**
     * Mencatat cicilan atau pelunasan hutang/piutang.
     */
    async payDebt(params: {
        userId: string;
        personName: string;
        amount: number;
    }): Promise<PayDebtResult | null> {
        // 1. Cari hutang/piutang aktif (UNPAID / PARTIAL) atas nama orang tsb
        const { data: debt } = await supabase
            .from('debts')
            .select('*')
            .eq('user_id', params.userId)
            .ilike('person_name', params.personName)
            .in('status', ['UNPAID', 'PARTIAL'])
            .order('created_at', { ascending: true })
            .limit(1)
            .single();

        if (!debt) {
            console.warn(`Tidak ditemukan catatan hutang/piutang aktif atas nama ${params.personName}`);
            return null;
        }

        const currentRemaining = Number(debt.remaining_amount || 0);
        let newRemaining = currentRemaining - params.amount;
        let newStatus: 'PAID' | 'PARTIAL' = 'PARTIAL';

        if (newRemaining <= 0) {
            newRemaining = 0;
            newStatus = 'PAID';
        }

        // 2. Update catatan di database
        const { error: updateErr } = await supabase
            .from('debts')
            .update({
                remaining_amount: newRemaining,
                status: newStatus,
                updated_at: new Date().toISOString()
            })
            .eq('id', debt.id);

        if (updateErr) {
            console.error("Gagal update cicilan hutang:", updateErr);
            throw updateErr;
        }

        return {
            personName: debt.person_name,
            paidAmount: params.amount,
            remainingAmount: newRemaining,
            status: newStatus,
            debtType: debt.type as 'PAYABLE' | 'RECEIVABLE'
        };
    }
}

export const debtService = new DebtService();
