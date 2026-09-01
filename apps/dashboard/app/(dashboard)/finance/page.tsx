import { createClient } from '@/lib/supabase/server';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Plus, Wallet, Target, Clock, ArrowDownLeft, ArrowUpRight, CheckCircle2, ChevronRight } from 'lucide-react';
import Link from 'next/link';

export const revalidate = 30;

export default async function FinancePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;

  let accounts: any[] = [];
  let transactions: any[] = [];
  let debts: any[] = [];
  let budgetsList: any[] = [];
  let totalBalance = 0;

  if (userId) {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    const startOfMonth = new Date(currentYear, currentMonth - 1, 1).toISOString();

    const [accsRes, txsRes, dbtsRes, bgtsRes] = await Promise.all([
      supabase.from('bank_accounts').select('*').eq('user_id', userId).order('balance', { ascending: false }),
      supabase
        .from('transactions')
        .select('*, bank_accounts (name), transaction_categories (name)')
        .eq('user_id', userId)
        .order('transaction_date', { ascending: false })
        .limit(10),
      supabase
        .from('debts')
        .select('*')
        .eq('user_id', userId)
        .in('status', ['UNPAID', 'PARTIAL'])
        .order('created_at', { ascending: false }),
      supabase
        .from('budgets')
        .select('id, amount, month, year, transaction_categories (id, name)')
        .eq('user_id', userId)
        .eq('month', currentMonth)
        .eq('year', currentYear),
    ]);

    accounts = accsRes.data || [];
    transactions = txsRes.data || [];
    debts = dbtsRes.data || [];
    
    totalBalance = accounts.reduce((sum, a) => sum + Number(a.balance), 0);

    if (bgtsRes.data && bgtsRes.data.length > 0) {
      const { data: bgtTxs } = await supabase
        .from('transactions')
        .select('category_id, amount')
        .eq('user_id', userId)
        .eq('type', 'expense')
        .gte('transaction_date', startOfMonth);

      budgetsList = bgtsRes.data.map((b: any) => {
        const spent = bgtTxs
          ? bgtTxs.filter(t => t.category_id === b.transaction_categories?.id)
                  .reduce((sum, t) => sum + Number(t.amount), 0)
          : 0;
        return {
          id: b.id,
          categoryName: b.transaction_categories?.name || 'Lainnya',
          amount: Number(b.amount),
          spent
        };
      });
    }
  }

  const formatRupiah = (num: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
  };

  return (
    <div className="p-6 pt-8 pb-32">
      {/* Header */}
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-on-surface">Keuangan</h1>
          <p className="text-secondary text-sm mt-1">Kelola aset dan riwayat transaksi</p>
        </div>
        <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-primary relative">
          <Plus className="w-5 h-5" />
        </div>
      </header>

      {/* Saldo Utama & Rekening */}
      <section className="mb-8">
        <div className="bg-surface-bright border-2 border-surface-variant rounded-[24px] p-5 shadow-[0_8px_24px_rgba(24,26,42,0.04)]">
          <p className="text-secondary text-sm font-medium mb-1">Total Kas & Rekening</p>
          <h2 className="text-[32px] font-extrabold tracking-tight tabular-nums text-on-surface mb-5">{formatRupiah(totalBalance)}</h2>
          
          <div className="flex flex-col gap-3">
            {accounts.map(acc => (
              <div key={acc.id} className="flex justify-between items-center p-3 bg-surface-container-low rounded-[16px]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <span className="font-bold text-on-surface text-sm">{acc.name}</span>
                </div>
                <span className="font-bold text-on-surface tabular-nums">{formatRupiah(Number(acc.balance))}</span>
              </div>
            ))}
            {accounts.length === 0 && <p className="text-sm text-secondary text-center py-2">Belum ada akun.</p>}
          </div>
        </div>
      </section>

      {/* Budget List */}
      <section className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" /> Budget Bulan Ini
          </h3>
        </div>
        <div className="bg-surface-bright rounded-[24px] p-5 border border-surface-variant shadow-[0_8px_24px_rgba(24,26,42,0.04)]">
          {budgetsList.length > 0 ? (
            <div className="flex flex-col gap-5">
              {budgetsList.map(bgt => {
                const percent = Math.min(100, Math.round((bgt.spent / bgt.amount) * 100));
                const isOver = bgt.spent > bgt.amount;
                return (
                  <div key={bgt.id}>
                    <div className="flex justify-between items-end mb-2">
                      <div>
                        <p className="font-bold text-on-surface text-sm">{bgt.categoryName}</p>
                        <p className="text-xs text-secondary mt-0.5">
                          {formatRupiah(bgt.spent)} / {formatRupiah(bgt.amount)}
                        </p>
                      </div>
                      <span className={`text-xs font-bold ${isOver ? 'text-danger' : 'text-primary'}`}>{percent}%</span>
                    </div>
                    <div className="w-full bg-surface-variant rounded-full h-2.5 overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${isOver ? 'bg-danger' : 'bg-primary'}`} 
                        style={{ width: `${percent}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-secondary text-center py-4">Belum ada budget yang ditetapkan.</p>
          )}
        </div>
      </section>

      {/* Hutang / Piutang */}
      <section className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" /> Hutang & Piutang
          </h3>
        </div>
        <div className="flex flex-col gap-3">
          {debts.map(debt => (
            <div key={debt.id} className="bg-surface-bright p-4 rounded-[20px] border border-surface-variant shadow-[0_8px_24px_rgba(24,26,42,0.04)] flex justify-between items-center">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${debt.type === 'PAYABLE' ? 'bg-peach-bg text-peach-fg' : 'bg-mint-bg text-mint-fg'}`}>
                    {debt.type === 'PAYABLE' ? 'Hutang' : 'Piutang'}
                  </span>
                  <span className="text-sm font-bold text-on-surface">{debt.person_name}</span>
                </div>
                <p className="text-xs text-secondary line-clamp-1">{debt.description || 'Tanpa catatan'}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-on-surface tabular-nums mb-1">{formatRupiah(Number(debt.remaining_amount))}</p>
                <div className="flex items-center gap-1 justify-end text-primary text-xs font-bold">
                  Lunasi <ChevronRight className="w-3 h-3" />
                </div>
              </div>
            </div>
          ))}
          {debts.length === 0 && (
             <div className="bg-surface-bright p-5 rounded-[20px] border border-surface-variant text-center">
               <CheckCircle2 className="w-8 h-8 text-mint-fg mx-auto mb-2" />
               <p className="text-sm text-on-surface font-bold">Bebas Hutang</p>
               <p className="text-xs text-secondary mt-1">Tidak ada hutang atau piutang aktif.</p>
             </div>
          )}
        </div>
      </section>

      {/* Transaksi Terbaru */}
      <section>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-on-surface">Riwayat Transaksi</h3>
        </div>
        <div className="bg-surface-bright rounded-[24px] border border-surface-variant shadow-[0_8px_24px_rgba(24,26,42,0.04)] p-2">
          <div className="flex flex-col gap-1">
            {transactions.map(tx => (
              <div key={tx.id} className="flex items-center justify-between p-3 hover:bg-surface-container-lowest active:bg-surface-container transition-colors rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${tx.type === 'expense' ? 'bg-peach-bg text-peach-fg' : 'bg-mint-bg text-mint-fg'}`}>
                    {tx.type === 'expense' ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownLeft className="w-5 h-5" />}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-on-surface line-clamp-1">{tx.transaction_categories?.name || tx.description || 'Lainnya'}</p>
                    <p className="text-xs text-secondary mt-0.5">{format(new Date(tx.transaction_date), 'dd MMM yyyy', { locale: id })} • {tx.bank_accounts?.name}</p>
                  </div>
                </div>
                <p className={`text-sm font-bold tabular-nums ${tx.type === 'expense' ? 'text-on-surface' : 'text-mint-fg'}`}>
                  {tx.type === 'expense' ? '-' : '+'}{formatRupiah(Number(tx.amount))}
                </p>
              </div>
            ))}
            {transactions.length === 0 && <p className="text-center text-sm text-secondary py-6">Belum ada riwayat.</p>}
          </div>
        </div>
      </section>
    </div>
  );
}
