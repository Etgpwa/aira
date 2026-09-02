import { createClient } from '@/lib/supabase/server';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { ArrowDownLeft, ArrowUpRight, Plus, Activity, Bell, Target, Settings } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';

// Lazy load FinanceChart (recharts) agar tidak masuk ke initial bundle
const FinanceChart = dynamic(() => import('@/components/FinanceChart'), {
  ssr: false,
  loading: () => (
    <div className="h-[250px] flex items-center justify-center">
      <p className="text-secondary text-sm">Memuat grafik...</p>
    </div>
  ),
});

export const revalidate = 30;

export default async function Home() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;

  // Fetch Data
  let totalSaldo = 0;
  let pengeluaranBulanIni = 0;
  let pemasukanBulanIni = 0;
  let chartData: any[] = [];
  let recentTransactions: any[] = [];

  if (userId) {
    const [accountsRes, transactionsRes, recentRes] = await Promise.all([
      supabase.from('bank_accounts').select('balance').eq('user_id', userId),
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
      supabase
        .from('transactions')
        .select('id, amount, type, category, description, transaction_date')
        .eq('user_id', userId)
        .order('transaction_date', { ascending: false })
        .limit(3)
    ]);

    totalSaldo = accountsRes.data?.reduce((sum, acc) => sum + Number(acc.balance), 0) || 0;
    recentTransactions = recentRes.data || [];

    // Chart Data 6 bulan
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
  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || 'User';

  return (
    <div>
      {/* Header Profil */}
      <header className="flex justify-between items-center mb-8">
        <div>
          <p className="text-secondary text-sm font-medium">{today}</p>
          <h1 className="text-2xl font-extrabold tracking-tight mt-1 text-on-surface">Halo, {firstName} 👋</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/settings"
            title="Pengaturan"
            className="w-10 h-10 rounded-full bg-surface-container hover:bg-surface-container-high transition-colors flex items-center justify-center text-secondary hover:text-on-surface"
          >
            <Settings className="w-5 h-5" />
          </Link>
          <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-primary relative">
            <Bell className="w-5 h-5" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-danger rounded-full border-2 border-surface"></span>
          </div>
        </div>
      </header>

      {/* Top section: Hero + Stats (lg: side by side) */}
      <div className="lg:grid lg:grid-cols-[1fr_300px] lg:gap-6 mb-8">
        {/* Hero Balance Card */}
        <div className="bg-accent-gradient rounded-[24px] p-6 text-on-primary shadow-[0_12px_24px_rgba(56,74,216,0.25)] relative overflow-hidden mb-4 lg:mb-0">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full blur-xl translate-y-1/2 -translate-x-1/2" />
          <div className="relative z-10">
            <p className="text-white/80 text-sm font-medium mb-1">Total Saldo Aktif</p>
            <h2 className="text-[32px] font-extrabold tracking-tight tabular-nums mb-6">{formatRupiah(totalSaldo)}</h2>
            <div className="flex gap-3">
              <Link href="/finance" className="flex-1 bg-white/20 hover:bg-white/30 transition-colors text-white font-bold py-2.5 rounded-full flex items-center justify-center gap-1.5 text-sm backdrop-blur-sm">
                <Plus className="w-4 h-4" /> Catat
              </Link>
              <Link href="/finance/goals" className="flex-1 bg-white/20 hover:bg-white/30 transition-colors text-white font-bold py-2.5 rounded-full flex items-center justify-center gap-1.5 text-sm backdrop-blur-sm">
                <Target className="w-4 h-4" /> Goal
              </Link>
            </div>
          </div>
        </div>

        {/* Stats: Pemasukan & Pengeluaran */}
        <div className="flex flex-col gap-3">
          <div className="bg-surface-bright rounded-[20px] p-4 shadow-[0_8px_24px_rgba(24,26,42,0.06)] border border-surface-variant flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-mint-bg flex items-center justify-center text-mint-fg flex-shrink-0">
              <ArrowDownLeft className="w-5 h-5" />
            </div>
            <div>
              <p className="text-secondary text-xs font-medium">Pemasukan Bulan Ini</p>
              <p className="text-base font-bold tabular-nums text-on-surface">{formatRupiah(pemasukanBulanIni)}</p>
            </div>
          </div>
          <div className="bg-surface-bright rounded-[20px] p-4 shadow-[0_8px_24px_rgba(24,26,42,0.06)] border border-surface-variant flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-peach-bg flex items-center justify-center text-peach-fg flex-shrink-0">
              <ArrowUpRight className="w-5 h-5" />
            </div>
            <div>
              <p className="text-secondary text-xs font-medium">Pengeluaran Bulan Ini</p>
              <p className="text-base font-bold tabular-nums text-on-surface">{formatRupiah(pengeluaranBulanIni)}</p>
            </div>
          </div>
          {/* Quick action extra — visible only md+ */}
          <div className="hidden md:flex gap-2">
            <Link href="/finance" className="flex-1 bg-surface-container hover:bg-surface-container-high transition-colors text-primary font-bold py-2.5 rounded-full flex items-center justify-center gap-1.5 text-sm">
              <Plus className="w-4 h-4" /> Catat Transaksi
            </Link>
          </div>
        </div>
      </div>

      {/* Chart + Aktivitas (lg: side by side) */}
      <div className="lg:grid lg:grid-cols-[1.5fr_1fr] lg:gap-6">
        {/* Chart Kas */}
        <section className="mb-8 lg:mb-0">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" /> Arus Kas
            </h3>
          </div>
          <div className="bg-surface-bright rounded-[20px] p-5 shadow-[0_8px_24px_rgba(24,26,42,0.06)] border border-surface-variant">
            <FinanceChart data={chartData} />
          </div>
        </section>

        {/* Aktivitas Terbaru */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-on-surface">Aktivitas Terakhir</h3>
            <Link href="/finance" className="text-primary text-xs font-bold hover:underline">Lihat Semua</Link>
          </div>
          <div className="bg-surface-bright rounded-[20px] shadow-[0_8px_24px_rgba(24,26,42,0.06)] border border-surface-variant overflow-hidden p-2">
            {recentTransactions.length > 0 ? (
              <div className="flex flex-col gap-1">
                {recentTransactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between p-3 bg-surface-container-low rounded-2xl">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tx.type === 'expense' ? 'bg-peach-bg text-peach-fg' : 'bg-mint-bg text-mint-fg'}`}>
                        {tx.type === 'expense' ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownLeft className="w-5 h-5" />}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-on-surface line-clamp-1">{tx.category || tx.description || 'Transaksi'}</p>
                        <p className="text-xs text-secondary mt-0.5">{format(new Date(tx.transaction_date), 'd MMM', { locale: id })}</p>
                      </div>
                    </div>
                    <p className={`text-sm font-bold tabular-nums ${tx.type === 'expense' ? 'text-on-surface' : 'text-mint-fg'}`}>
                      {tx.type === 'expense' ? '-' : '+'}{formatRupiah(Number(tx.amount))}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-secondary text-sm py-8">Belum ada aktivitas transaksi.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
