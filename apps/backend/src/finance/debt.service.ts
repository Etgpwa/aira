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
        // 1. Cari SEMUA hutang/piutang aktif (UNPAID / PARTIAL) atas nama orang tsb
        const { data: debts } = await supabase
            .from('debts')
            .select('*')
            .eq('user_id', params.userId)
            .ilike('person_name', params.personName)
            .in('status', ['UNPAID', 'PARTIAL'])
            .order('created_at', { ascending: true }); // Bayar yang paling lama dulu

        if (!debts || debts.length === 0) {
            console.warn(`Tidak ditemukan catatan hutang/piutang aktif atas nama ${params.personName}`);
            return null;
        }

        let remainingPayment = params.amount;
        const debtType = debts[0].type;
        
        for (const debt of debts) {
            if (remainingPayment <= 0) break;

            const currentRemaining = Number(debt.remaining_amount || 0);
            
            if (currentRemaining <= remainingPayment) {
                // Hutang ini lunas
                remainingPayment -= currentRemaining;
                await supabase
                    .from('debts')
                    .update({
                        remaining_amount: 0,
                        status: 'PAID',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', debt.id);
            } else {
                // Hutang ini dibayar sebagian
                const newRemaining = currentRemaining - remainingPayment;
                remainingPayment = 0;
                await supabase
                    .from('debts')
                    .update({
                        remaining_amount: newRemaining,
                        status: 'PARTIAL',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', debt.id);
            }
        }

        // Tampilkan sisa hutang keseluruhan orang tersebut
        const { data: updatedDebts } = await supabase
            .from('debts')
            .select('remaining_amount')
            .eq('user_id', params.userId)
            .ilike('person_name', params.personName)
            .in('status', ['UNPAID', 'PARTIAL']);

        const totalRemaining = (updatedDebts || []).reduce((sum, d) => sum + Number(d.remaining_amount || 0), 0);

        return {
            personName: debts[0].person_name,
            paidAmount: params.amount,
            remainingAmount: totalRemaining,
            status: totalRemaining === 0 ? 'PAID' : 'PARTIAL',
            debtType: debtType as 'PAYABLE' | 'RECEIVABLE'
        };
    }

    /**
     * Menghapus (membatalkan) catatan hutang/piutang yang salah input
     */
    async deleteDebt(params: { userId: string, personName: string }) {
        // Cari hutang/piutang terakhir atas nama orang tersebut yang masih aktif
        const { data: debts, error } = await supabase
            .from('debts')
            .select('*')
            .eq('user_id', params.userId)
            .ilike('person_name', params.personName)
            .in('status', ['UNPAID', 'PARTIAL'])
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error || !debts) {
            return null;
        }

        const { error: delErr } = await supabase
            .from('debts')
            .delete()
            .eq('id', debts.id);

        if (delErr) {
            console.error('Gagal menghapus hutang:', delErr);
            return null;
        }

        return debts;
    }
}

export const debtService = new DebtService();
