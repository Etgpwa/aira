import { createClient } from '@/lib/supabase/server';
import { PiggyBank, Target, Plus } from 'lucide-react';
import AddGoalModal from './components/AddGoalModal';
import GoalCard from './components/GoalCard';

export const revalidate = 30;

export default async function GoalsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;

  let goals: any[] = [];
  let accounts: any[] = [];
  
  if (userId) {
    const [goalsRes, accsRes] = await Promise.all([
      supabase
        .from('goals')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      supabase
        .from('bank_accounts')
        .select('id, name, balance')
        .eq('user_id', userId)
        .order('balance', { ascending: false })
    ]);
    
    goals = goalsRes.data || [];
    accounts = accsRes.data || [];
  }

  const formatRupiah = (num: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
  };

  const totalSaved = goals.reduce((sum, g) => sum + Number(g.current_amount || 0), 0);
  const totalTarget = goals.reduce((sum, g) => sum + Number(g.target_amount || 0), 0);

  return (
    <div>
      {/* Header */}
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-on-surface">Tabungan & Goals</h1>
          <p className="text-secondary text-sm mt-1">Wujudkan impianmu pelan-pelan</p>
        </div>
        
        {/* Tombol Buat Target Baru di Header */}
        <AddGoalModal accounts={accounts} />
      </header>

      {/* Ringkasan Goals */}
      <section className="mb-8">
        <div className="bg-accent-gradient rounded-[24px] p-6 text-on-primary shadow-[0_12px_24px_rgba(56,74,216,0.25)] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full blur-xl translate-y-1/2 -translate-x-1/2" />
          
          <div className="flex items-center justify-between relative z-10">
            <div>
              <p className="text-white/80 text-sm font-medium mb-1">Total Tabungan Terkumpul</p>
              <h2 className="text-[28px] font-extrabold tracking-tight tabular-nums">
                {formatRupiah(totalSaved)}
              </h2>
              {totalTarget > 0 && (
                <p className="text-white/70 text-xs mt-1">
                  dari total target {formatRupiah(totalTarget)} ({Math.min(100, Math.round((totalSaved / totalTarget) * 100))}%)
                </p>
              )}
            </div>
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm shadow-inner">
              <PiggyBank className="w-7 h-7 text-white" />
            </div>
          </div>
        </div>
      </section>

      {/* Daftar Goals */}
      <section>
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-lg font-bold text-on-surface">Target Berjalan ({goals.length})</h3>
          
          <AddGoalModal
            accounts={accounts}
            triggerButton={
              <button className="text-primary hover:text-primary-container text-xs font-bold flex items-center gap-1 bg-surface-container hover:bg-surface-container-high px-3.5 py-2 rounded-full transition-colors cursor-pointer">
                <Plus className="w-4 h-4" /> Buat Target Baru
              </button>
            }
          />
        </div>
        
        {/* Grid Card Goals */}
        <div className="flex flex-col gap-4 md:grid md:grid-cols-2">
          {goals.map(goal => (
            <GoalCard
              key={goal.id}
              goal={goal}
              accounts={accounts}
            />
          ))}

          {goals.length === 0 && (
            <div className="bg-surface-bright p-10 rounded-[28px] border border-surface-variant text-center border-dashed col-span-2">
              <div className="w-16 h-16 bg-surface-container rounded-full flex items-center justify-center text-primary mx-auto mb-4">
                <Target className="w-8 h-8" />
              </div>
              <p className="text-base text-on-surface font-extrabold">Belum Ada Target Tabungan</p>
              <p className="text-sm text-secondary mt-1.5 max-w-md mx-auto">
                Mulai tetapkan impianmu hari ini (misal: beli gadget baru, dana darurat, atau liburan).
              </p>
              <div className="mt-5 flex justify-center">
                <AddGoalModal
                  accounts={accounts}
                  triggerButton={
                    <button className="bg-primary hover:bg-primary-container text-on-primary px-5 py-2.5 rounded-full font-bold text-xs flex items-center gap-1.5 shadow-sm">
                      <Plus className="w-4 h-4" /> Buat Target Tabungan Pertama
                    </button>
                  }
                />
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
