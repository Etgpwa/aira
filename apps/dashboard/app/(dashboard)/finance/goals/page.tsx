import { createClient } from '@/lib/supabase/server';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Target, Plus, TrendingUp, PiggyBank, CheckCircle2 } from 'lucide-react';

export const revalidate = 30;

export default async function GoalsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;

  let goals: any[] = [];
  
  if (userId) {
    const { data } = await supabase
      .from('financial_goals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    goals = data || [];
  }

  const formatRupiah = (num: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
  };

  return (
    <div className="p-6 pt-8 pb-32">
      {/* Header */}
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-on-surface">Tabungan & Goals</h1>
          <p className="text-secondary text-sm mt-1">Wujudkan impianmu pelan-pelan</p>
        </div>
        <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-primary relative">
          <Target className="w-5 h-5" />
        </div>
      </header>

      {/* Ringkasan Goals */}
      <section className="mb-8">
        <div className="bg-accent-gradient rounded-[24px] p-6 text-on-primary shadow-[0_12px_24px_rgba(56,74,216,0.25)] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
          
          <div className="flex items-center justify-between relative z-10">
            <div>
              <p className="text-white/80 text-sm font-medium mb-1">Total Tabungan Goals</p>
              <h2 className="text-[28px] font-extrabold tracking-tight tabular-nums">
                {formatRupiah(goals.reduce((sum, g) => sum + Number(g.current_amount), 0))}
              </h2>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
              <PiggyBank className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
      </section>

      {/* Daftar Goals */}
      <section>
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-lg font-bold text-on-surface">Target Berjalan</h3>
          <button className="text-primary text-sm font-bold flex items-center gap-1">
            <Plus className="w-4 h-4" /> Buat Baru
          </button>
        </div>
        
        <div className="flex flex-col gap-4">
          {goals.map(goal => {
            const current = Number(goal.current_amount);
            const target = Number(goal.target_amount);
            const percent = Math.min(100, Math.round((current / target) * 100));
            const isCompleted = current >= target;

            return (
              <div key={goal.id} className="bg-surface-bright rounded-[24px] p-5 border border-surface-variant shadow-[0_8px_24px_rgba(24,26,42,0.04)] relative overflow-hidden">
                {isCompleted && (
                  <div className="absolute top-0 right-0 w-16 h-16 bg-mint-bg rounded-bl-full flex items-start justify-end p-2 z-0">
                    <CheckCircle2 className="w-5 h-5 text-mint-fg relative -top-1 -right-1" />
                  </div>
                )}
                
                <div className="relative z-10">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-12 h-12 bg-surface-container rounded-2xl flex items-center justify-center text-primary text-xl">
                      {goal.icon || '🎯'}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-on-surface line-clamp-1">{goal.name}</h4>
                      <p className="text-xs text-secondary mt-1">Target: {goal.target_date ? format(new Date(goal.target_date), 'MMM yyyy', { locale: id }) : 'Kapan saja'}</p>
                    </div>
                  </div>

                  <div className="flex justify-between items-end mb-2">
                    <p className="font-bold text-on-surface text-sm tabular-nums">{formatRupiah(current)}</p>
                    <p className="text-xs text-secondary font-medium">dari {formatRupiah(target)}</p>
                  </div>
                  
                  <div className="w-full bg-surface-variant rounded-full h-2.5 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-1000 ${isCompleted ? 'bg-mint-fg' : 'bg-primary'}`} 
                      style={{ width: `${percent}%` }}
                    ></div>
                  </div>
                  <div className="mt-3 flex justify-between items-center text-xs">
                    <span className={`font-bold ${isCompleted ? 'text-mint-fg' : 'text-primary'}`}>{percent}% Tercapai</span>
                    {!isCompleted && (
                       <span className="flex items-center gap-1 text-on-surface-variant font-medium">
                         <TrendingUp className="w-3.5 h-3.5 text-mint-fg" />
                         Sisa {formatRupiah(target - current)}
                       </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {goals.length === 0 && (
             <div className="bg-surface-bright p-8 rounded-[24px] border border-surface-variant text-center border-dashed">
               <div className="w-16 h-16 bg-surface-container rounded-full flex items-center justify-center text-primary mx-auto mb-4">
                 <Target className="w-8 h-8" />
               </div>
               <p className="text-base text-on-surface font-bold">Belum ada Tabungan</p>
               <p className="text-sm text-secondary mt-2">Chat Karen untuk bikin target baru. Contoh: "Karen, bikin target beli laptop 10 juta"</p>
             </div>
          )}
        </div>
      </section>
    </div>
  );
}
