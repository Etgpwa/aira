import { createClient } from '@/lib/supabase/server';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Wallet, TrendingDown, TrendingUp, AlertCircle } from 'lucide-react';
import dynamic from 'next/dynamic';
import './page.css';

// Lazy load FinanceChart (recharts ~500KB) agar tidak masuk ke initial bundle
const FinanceChart = dynamic(() => import('@/components/FinanceChart'), {
  ssr: false,
  loading: () => (
    <div style={{ height: '250px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Memuat grafik...</p>
    </div>
  ),
});

export const revalidate = 30;

// Komponen Helper Card
function SummaryCard({ title, amount, icon: Icon, colorClass }: { title: string, amount: string, icon: any, colorClass: string }) {
  return (
    <div className="card summary-card">
      <div className="summary-header">
        <h3 className="text-secondary text-sm font-medium">{title}</h3>
        <Icon size={20} className={colorClass} />
      </div>
      <p className="summary-amount text-2xl font-bold mt-2">{amount}</p>
    </div>
  );
}

export default async function Home() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;

  // State awal
  let totalSaldo = 0;
  let totalHutang = 0;
  let pengeluaranBulanIni = 0;
  let pemasukanBulanIni = 0;
  let chartData: any[] = [];
  
  if (userId) {
    // Jalankan semua query secara paralel (bukan sequential) untuk mempercepat load
    const [accountsRes, debtsRes, transactionsRes] = await Promise.all([
      supabase.from('bank_accounts').select('balance').eq('user_id', userId),
      supabase
        .from('debts')
        .select('remaining_amount')
        .eq('user_id', userId)
        .eq('type', 'PAYABLE')
        .in('status', ['UNPAID', 'PARTIAL']),
      supabase
        .from('transactions')
        .select('amount, type, transaction_date')
        .eq('user_id', userId)
        .gte('transaction_date', (() => {
          const d = new Date();
          d.setMonth(d.getMonth() - 5);
          d.setDate(1);
          return d.toISOString();
        })()),
    ]);

    totalSaldo = accountsRes.data?.reduce((sum, acc) => sum + Number(acc.balance), 0) || 0;
    totalHutang = debtsRes.data?.reduce((sum, debt) => sum + Number(debt.remaining_amount), 0) || 0;

    // Buat list 6 bulan terakhir
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      chartData.push({
        monthKey: format(d, 'yyyy-MM'),
        name: format(d, 'MMM', { locale: id }),
        Pemasukan: 0,
        Pengeluaran: 0
      });
    }

    if (transactionsRes.data) {
      transactionsRes.data.forEach(t => {
        const txMonth = format(new Date(t.transaction_date), 'yyyy-MM');
        const monthData = chartData.find(c => c.monthKey === txMonth);

        if (monthData) {
          if (t.type === 'expense') monthData.Pengeluaran += Number(t.amount);
          if (t.type === 'income') monthData.Pemasukan += Number(t.amount);
        }

        const thisMonth = format(new Date(), 'yyyy-MM');
        if (txMonth === thisMonth) {
          if (t.type === 'expense') pengeluaranBulanIni += Number(t.amount);
          if (t.type === 'income') pemasukanBulanIni += Number(t.amount);
        }
      });
    }
  }

  const formatRupiah = (num: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
  };

  const today = format(new Date(), 'EEEE, d MMMM yyyy', { locale: id });

  return (
    <div className="dashboard-container">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Ringkasan</h1>
        <p className="text-secondary mt-1">{today}</p>
      </header>

      <div className="summary-grid">
        <SummaryCard 
          title="Total Saldo" 
          amount={formatRupiah(totalSaldo)} 
          icon={Wallet} 
          colorClass="text-accent"
        />
        <SummaryCard 
          title="Pengeluaran Bulan Ini" 
          amount={formatRupiah(pengeluaranBulanIni)} 
          icon={TrendingDown} 
          colorClass="text-danger"
        />
        <SummaryCard 
          title="Pemasukan Bulan Ini" 
          amount={formatRupiah(pemasukanBulanIni)} 
          icon={TrendingUp} 
          colorClass="text-success"
        />
        <SummaryCard 
          title="Hutang Aktif" 
          amount={formatRupiah(totalHutang)}
          icon={AlertCircle} 
          colorClass="text-warning"
        />
      </div>

      <div className="mt-8 card" style={{ height: '350px' }}>
        <h2 className="text-lg font-semibold mb-6">Arus Kas (6 Bulan Terakhir)</h2>
        <div style={{ height: '250px' }}>
          <FinanceChart data={chartData} />
        </div>
      </div>
    </div>
  );
}
