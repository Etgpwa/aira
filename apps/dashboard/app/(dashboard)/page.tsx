import { createClient } from '@/lib/supabase/server';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { ArrowDownLeft, ArrowUpRight, Plus, Activity, Target, Settings } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import ReminderHubModal from '@/components/ReminderHubModal';

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
  let reminders: any[] = [];
  let workRoutine: any = null;

  if (userId) {
    const [accountsRes, transactionsRes, recentRes, remindersRes, routineRes] = await Promise.all([
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
        .limit(3),
      supabase
        .from('reminders')
        .select('*')
        .eq('user_id', userId)
        .order('remind_at', { ascending: true }),
      supabase
        .from('work_routines')
        .select('story_reminder_time')
        .eq('user_id', userId)
        .maybeSingle()
    ]);

    totalSaldo = accountsRes.data?.reduce((sum, acc) => sum + Number(acc.balance), 0) || 0;
    recentTransactions = recentRes.data || [];
    reminders = remindersRes.data || [];
    workRoutine = routineRes.data;

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
          <h1 className="text-2xl font-extrabold tracking-tight mt-1 text-on-surface">Halo, {firstName}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/settings"
            title="Pengaturan"
            className="w-10 h-10 rounded-full bg-surface-container hover:bg-surface-container-high transition-colors flex items-center justify-center text-secondary hover:text-on-surface"
          >
            <Settings className="w-5 h-5" />
          </Link>
          
          {/* Modal Pusat Pengingat & Notifikasi (Icon Lonceng) */}
          <ReminderHubModal
            initialReminders={reminders}
            routineInfo={workRoutine}
          />
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
                <Target className="w-4 h-4" /> Goals
              </Link>
            </div>
          </div>
        </div>

        {/* Stats 2 Card (Pemasukan & Pengeluaran) */}
        <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
          <div className="bg-surface-bright border border-surface-variant p-4 rounded-[20px] shadow-[0_8px_24px_rgba(24,26,42,0.04)] flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-mint-bg flex items-center justify-center text-mint-fg shrink-0">
              <ArrowDownLeft className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-secondary uppercase tracking-wider">Masuk</p>
              <p className="text-sm sm:text-base font-extrabold text-on-surface truncate tabular-nums">{formatRupiah(pemasukanBulanIni)}</p>
            </div>
          </div>
          <div className="bg-surface-bright border border-surface-variant p-4 rounded-[20px] shadow-[0_8px_24px_rgba(24,26,42,0.04)] flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-peach-bg flex items-center justify-center text-peach-fg shrink-0">
              <ArrowUpRight className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-secondary uppercase tracking-wider">Keluar</p>
              <p className="text-sm sm:text-base font-extrabold text-on-surface truncate tabular-nums">{formatRupiah(pengeluaranBulanIni)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Mid section: Chart + Activity (lg: 2 columns) */}
      <div className="lg:grid lg:grid-cols-[1.5fr_1fr] lg:gap-8">
        {/* Cash Flow Chart */}
        <div className="bg-surface-bright border border-surface-variant rounded-[24px] p-6 shadow-[0_8px_24px_rgba(24,26,42,0.04)] mb-6 lg:mb-0">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-base font-bold text-on-surface">Arus Kas</h3>
              <p className="text-xs text-secondary mt-0.5">Tren 6 bulan terakhir</p>
            </div>
            <span className="text-xs font-bold text-primary bg-surface-container px-3 py-1 rounded-full">
              6 Bulan
            </span>
          </div>
          <FinanceChart data={chartData} />
        </div>

        {/* Recent Transactions */}
        <div className="bg-surface-bright border border-surface-variant rounded-[24px] p-5 shadow-[0_8px_24px_rgba(24,26,42,0.04)]">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-base font-bold text-on-surface">Transaksi Terakhir</h3>
            <Link href="/finance" className="text-xs font-bold text-primary hover:underline">
              Lihat Semua
            </Link>
          </div>

          <div className="flex flex-col gap-3">
            {recentTransactions.length === 0 ? (
              <p className="text-secondary text-sm text-center py-6">Belum ada transaksi</p>
            ) : (
              recentTransactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between p-2.5 rounded-xl hover:bg-surface-container-low transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${tx.type === 'income' ? 'bg-mint-bg text-mint-fg' : 'bg-peach-bg text-peach-fg'}`}>
                      {tx.type === 'income' ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-on-surface">{tx.category || (tx.type === 'income' ? 'Pemasukan' : 'Pengeluaran')}</h4>
                      <p className="text-[11px] text-secondary">{format(new Date(tx.transaction_date), 'dd MMM yyyy, HH:mm', { locale: id })}</p>
                    </div>
                  </div>
                  <p className={`font-extrabold text-sm tabular-nums ${tx.type === 'income' ? 'text-mint-fg' : 'text-danger'}`}>
                    {tx.type === 'income' ? '+' : '-'}{formatRupiah(Number(tx.amount))}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
