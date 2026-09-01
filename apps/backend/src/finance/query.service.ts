import { supabase } from '../supabase/supabase.client';
import { askGemini } from '../ai/gemini.client';

export class QueryService {

    /**
     * Mengambil snapshot data keuangan lengkap user dari Supabase
     */
    async getFinancialContext(userId: string) {
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();

        const firstDayOfMonth = new Date(year, month - 1, 1).toISOString();
        const lastDayOfMonth = new Date(year, month, 0, 23, 59, 59).toISOString();

        // 1. Rekening & Saldo
        const { data: accounts } = await supabase
            .from('bank_accounts')
            .select('name, currency, balance')
            .eq('user_id', userId);

        // 2. Transaksi bulan ini
        const { data: transactions } = await supabase
            .from('transactions')
            .select(`
                amount,
                currency,
                original_amount,
                type,
                description,
                transaction_date,
                transaction_categories ( name )
            `)
            .eq('user_id', userId)
            .gte('transaction_date', firstDayOfMonth)
            .lte('transaction_date', lastDayOfMonth);

        // 3. Hutang & Piutang aktif
        const { data: debts } = await supabase
            .from('debts')
            .select('person_name, type, amount, remaining_amount, currency, status, due_date')
            .eq('user_id', userId)
            .in('status', ['UNPAID', 'PARTIAL']);

        // 4. Budget bulan ini
        const { data: budgets } = await supabase
            .from('budgets')
            .select(`
                amount,
                transaction_categories ( name )
            `)
            .eq('user_id', userId)
            .eq('month', month)
            .eq('year', year);

        // 5. Goals
        const { data: goals } = await supabase
            .from('goals')
            .select('name, target_amount, current_amount, status')
            .eq('user_id', userId)
            .eq('status', 'IN_PROGRESS');

        // 6. Tasks (Pending)
        const { data: tasks } = await supabase
            .from('tasks')
            .select('title, priority, due_date, status')
            .eq('user_id', userId)
            .in('status', ['TODO', 'IN_PROGRESS'])
            .order('due_date', { ascending: true, nullsFirst: false });

        // 7. Jadwal Rutin
        const { data: schedules } = await supabase
            .from('study_schedules')
            .select('subject, day_of_week, start_time, end_time')
            .eq('user_id', userId)
            .order('day_of_week', { ascending: true })
            .order('start_time', { ascending: true });

        const totalBankBalance = (accounts || []).reduce((sum, acc) => sum + Number(acc.balance || 0), 0);
        const totalGoalAllocation = (goals || []).reduce((sum, g) => sum + Number(g.current_amount || 0), 0);
        const freeBalance = totalBankBalance - totalGoalAllocation;

        return {
            summary: {
                total_bank_balance: totalBankBalance,
                total_allocated_to_goals: totalGoalAllocation,
                free_balance_usable: freeBalance
            },
            accounts: accounts || [],
            current_month: {
                month,
                year,
                transactions: (transactions || []).map(t => ({
                    amount: t.amount,
                    currency: t.currency,
                    type: t.type,
                    category: (t.transaction_categories as any)?.name || 'Lain-lain',
                    description: t.description,
                    date: t.transaction_date
                }))
            },
            active_debts_receivables: (debts || []).map(d => ({
                person: d.person_name,
                type: d.type === 'PAYABLE' ? 'Hutangku (Aku harus bayar ke dia)' : 'Piutangku (Dia harus bayar ke aku)',
                total_amount: d.amount,
                remaining_amount: d.remaining_amount,
                currency: d.currency,
                status: d.status
            })),
            current_budgets: (budgets || []).map(b => ({
                category: (b.transaction_categories as any)?.name || 'Umum',
                limit_amount: b.amount
            })),
            goals: (goals || []).map(g => ({
                name: g.name,
                target: g.target_amount,
                current: g.current_amount
            })),
            pending_tasks: (tasks || []).map(t => ({
                title: t.title,
                priority: t.priority,
                due_date: t.due_date
            })),
            study_schedules: (schedules || []).map(s => ({
                subject: s.subject,
                day_of_week: s.day_of_week,
                start_time: s.start_time,
                end_time: s.end_time
            }))
        };
    }

    /**
     * Menjawab pertanyaan seputar keuangan / tugas / jadwal dari user berdasarkan data real-time database
     */
    async answerFinanceQuery(userId: string, question: string): Promise<string> {
        try {
            const context = await this.getFinancialContext(userId);

            const prompt = `
Kamu asisten pribadi yang menjawab pertanyaan user tentang keuangan, tugas, dan jadwal secara ringkas dan rapi.

DATA PRIBADI USER (real-time dari database, waktu saat ini: ${new Date().toISOString()}):
${JSON.stringify(context, null, 2)}

Pertanyaan user: "${question}"

ATURAN STRICT MENJAWAB (HARUS PATUH):
1. **DILARANG MENGGUNAKAN EMOJI / EMOTICON SAMA SEKALI (0 EMOJI).**
2. **FORMAT LIST**: Setiap item HARUS berbaris sendiri diawali simbol bullet (• ). DILARANG memisahkan item dengan koma dalam 1 baris.
3. **PISAHKAN TIAP KATEGORI DENGAN TEPAT 1 BARIS KOSONG (ENTER DUA KALI / \\n\\n)** agar ada jeda antar blok kategori.
   CONTOH FORMAT PERSIS:
   SALDO REKENING:
   • Total Saldo: Rp 5.000.000
   • Teralokasi ke Tabungan: Rp 1.000.000
   • Saldo Bebas (Bisa Dipakai): Rp 4.000.000
   • Bank Jago: Rp 3.000.000
   • Cash: Rp 2.000.000

   HUTANG:
   • Kakek: sisa Rp 6.000.000

   PIUTANG:
   • Dian: sisa Rp 150.000

   BUDGET:
   • Jajan: sisa Rp 9.000 dari limit Rp 100.000

   TARGET MENABUNG:
   • MacBook M1 Pro: Rp 2.500.000 dari target Rp 16.000.000

   TUGAS:
   • pengumpulan tugas: deadline 26 Ags jam 10:00 WIB (Prioritas MEDIUM)

4. **WAKTU / JAM**: Selalu tampilkan waktu dalam zona waktu lokal (WIB), jangan sebut "UTC".
5. **URUTAN URGENT**: Urutkan tugas dari yang paling urgent (due date terdekat / prioritas tinggi di atas).
6. **DILARANG BASA-BASI**: Tanpa salam pembuka ("Halo!", "Tentu!"), tanpa penutup ("Ada lagi?", "Semoga membantu!").
7. **JANGAN POTONG DETAIL**: Tampilkan rincian angka lengkap.
8. Jika data kategori tertentu kosong/tidak ada, lewati saja jangan dicantumkan.
9. Jangan sebut nama "Karen".
`;

            const reply = await askGemini(prompt);
            return reply.trim();
        } catch (error) {
            console.error("Gagal menjawab query keuangan:", error);
            return "error ambil data, coba lagi";
        }
    }
}

export const queryService = new QueryService();
