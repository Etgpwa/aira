import { createClient } from '@/lib/supabase/server';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import AddGoalModal from '@/components/AddGoalModal';
import DeleteGoalButton from '@/components/DeleteGoalButton';
import './page.css';

export default async function GoalsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;

  let goals: any[] = [];

  if (userId) {
    const { data } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    goals = data || [];
  }

  const formatRupiah = (num: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
  };

  return (
    <div className="goals-container">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Tabungan & Goals</h1>
        {userId && <AddGoalModal userId={userId} />}
      </div>

      <div className="goals-grid">
        {goals.map(goal => {
          const progress = goal.target_amount > 0 
            ? Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100))
            : 0;
          const isAchieved = goal.status === 'ACHIEVED' || goal.current_amount >= goal.target_amount;
            
          return (
            <div key={goal.id} className="goal-card card">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold text-lg">{goal.name}</h3>
                <div className="flex items-center gap-2">
                  <span className={`goal-status ${isAchieved ? 'status-completed' : 'status-progress'}`}>
                    {isAchieved ? 'Tercapai' : 'Proses'}
                  </span>
                  <DeleteGoalButton goalId={goal.id} goalName={goal.name} />
                </div>
              </div>
              
              <div className="goal-amounts mt-4">
                <div>
                  <p className="text-xs text-secondary">Terkumpul</p>
                  <p className="font-bold text-accent">{formatRupiah(Number(goal.current_amount))}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-secondary">Target</p>
                  <p className="font-bold">{formatRupiah(Number(goal.target_amount))}</p>
                </div>
              </div>
              
              <div className="progress-container mt-3">
                <div 
                  className="progress-bar" 
                  style={{ width: `${progress}%`, backgroundColor: isAchieved ? 'var(--success)' : 'var(--accent-color)' }}
                ></div>
              </div>
              <p className="text-right text-xs mt-1 font-medium">{progress}%</p>
              
              {goal.target_date && (
                <p className="text-xs text-secondary mt-4">
                  Target Waktu: {format(new Date(goal.target_date), 'dd MMM yyyy', { locale: id })}
                </p>
              )}
            </div>
          );
        })}
        {goals.length === 0 && (
          <div className="col-span-full card p-8 text-center text-secondary">
            Belum ada target tabungan atau goals.
          </div>
        )}
      </div>
    </div>
  );
}
