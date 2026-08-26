import { createClient } from '@/lib/supabase/server';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import AddTransactionModal from '@/components/AddTransactionModal';
import './page.css';

export const revalidate = 30;

export default async function FinancePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;

  let accounts: any[] = [];
  let transactions: any[] = [];
  let categories: any[] = [];
  let debts: any[] = [];
  let budgetsList: any[] = [];

  if (userId) {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    const startOfMonth = new Date(currentYear, currentMonth - 1, 1).toISOString();

    // Jalankan semua query secara paralel
    const [catsRes, accsRes, txsRes, dbtsRes, bgtsRes] = await Promise.all([
      supabase.from('transaction_categories').select('*').eq('user_id', userId),
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

    categories = catsRes.data || [];
    accounts = accsRes.data || [];
    transactions = txsRes.data || [];
    debts = dbtsRes.data || [];

    // Hitung pengeluaran per budget kategori (query budget transactions jika ada budget)
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
          categoryName: b.transaction_categories?.name || 'Tanpa Kategori',
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
    <div className="finance-container">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Keuangan</h1>
        {userId && accounts.length > 0 && categories.length > 0 && (
          <AddTransactionModal userId={userId} accounts={accounts} categories={categories} />
        )}
      </div>

      <div className="finance-grid">
        {/* Kolom Kiri: Akun & Transaksi */}
        <div className="finance-main flex-col gap-6">
          <section className="card">
            <h2 className="text-lg font-semibold mb-4">Rekening & Dompet</h2>
            <div className="accounts-list">
              {accounts.map(acc => (
                <div key={acc.id} className="account-item">
                  <span className="font-medium">{acc.name}</span>
                  <span className="font-bold">{formatRupiah(Number(acc.balance))}</span>
                </div>
              ))}
              {accounts.length === 0 && (
                <p className="text-secondary text-sm">Belum ada data rekening.</p>
              )}
            </div>
          </section>

          <section className="card">
            <h2 className="text-lg font-semibold mb-4">Transaksi Terbaru</h2>
            <div className="transactions-list">
              {transactions.map(tx => (
                <div key={tx.id} className="transaction-item">
                  <div className="tx-info">
                    <p className="font-medium">{tx.description || tx.transaction_categories?.name || 'Tanpa Kategori'}</p>
                    <p className="text-sm text-secondary">
                      {format(new Date(tx.transaction_date), 'dd MMM yyyy', { locale: id })} • {tx.bank_accounts?.name}
                    </p>
                  </div>
                  <div className={`tx-amount font-bold ${tx.type === 'expense' ? 'text-danger' : 'text-success'}`}>
                    {tx.type === 'expense' ? '-' : '+'}{formatRupiah(Number(tx.amount))}
                  </div>
                </div>
              ))}
              {transactions.length === 0 && (
                <p className="text-secondary text-sm">Belum ada data transaksi.</p>
              )}
            </div>
          </section>
        </div>

        {/* Kolom Kanan: Budget & Hutang */}
        <div className="finance-side flex-col gap-6">
          <section className="card">
            <h2 className="text-lg font-semibold mb-4">Budget Kategori (Bulan Ini)</h2>
            <div className="budgets-list flex flex-col gap-4">
              {budgetsList.map(bgt => {
                const percent = Math.min(100, Math.round((bgt.spent / bgt.amount) * 100));
                const isOver = bgt.spent > bgt.amount;
                return (
                  <div key={bgt.id} className="budget-item">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-medium">{bgt.categoryName}</span>
                      <span>{formatRupiah(bgt.spent)} / <span className="text-secondary">{formatRupiah(bgt.amount)}</span></span>
                    </div>
                    <div className="w-full bg-secondary/20 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${isOver ? 'bg-danger' : 'bg-primary'}`} 
                        style={{ width: `${percent}%` }}
                      ></div>
                    </div>
                    {isOver && <p className="text-danger text-xs mt-1">Melebihi budget!</p>}
                  </div>
                );
              })}
              {budgetsList.length === 0 && (
                <p className="text-secondary text-sm">Belum ada target budget bulan ini. Coba ngobrol sama Aira di WA buat nambah budget (contoh: "Aira, tolong set budget makan 1 juta").</p>
              )}
            </div>
          </section>

          <section className="card">
            <h2 className="text-lg font-semibold mb-4">Hutang & Piutang</h2>
            <div className="debts-list flex flex-col gap-3">
              {debts.map(debt => (
                <div key={debt.id} className="p-3 border rounded-lg flex justify-between items-center" style={{ borderColor: 'var(--border-color)' }}>
                  <div>
                    <p className="font-medium">{debt.person_name}</p>
                    <p className="text-xs text-secondary mt-1">{debt.description || (debt.type === 'PAYABLE' ? 'Hutangku' : 'Piutangku')}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">
                      {formatRupiah(Number(debt.remaining_amount))}
                    </p>
                    <span className="text-xs px-2 py-1 rounded bg-secondary/10 mt-1 inline-block">
                      {debt.type === 'PAYABLE' ? 'Hutang' : 'Piutang'}
                    </span>
                  </div>
                </div>
              ))}
              {debts.length === 0 && (
                <p className="text-secondary text-sm">Belum ada catatan hutang/piutang aktif.</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
