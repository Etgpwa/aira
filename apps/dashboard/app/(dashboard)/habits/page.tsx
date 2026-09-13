import { createClient } from '@/lib/supabase/server';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { id } from 'date-fns/locale';
import { isSameDay } from 'date-fns';
import { Activity, Clock, LogIn, LogOut, Sun, Moon, Briefcase, GraduationCap, MonitorPlay } from 'lucide-react';
import dynamic from 'next/dynamic';
import HabitLogHistory from './components/HabitLogHistory';

const HabitTrendChart = dynamic(() => import('./components/HabitTrendChart'), {
  ssr: false,
  loading: () => (
    <div className="h-48 w-full bg-surface-container rounded-2xl animate-pulse flex items-center justify-center">
      <p className="text-secondary text-sm">Memuat grafik tren...</p>
    </div>
  ),
});

const TZ = 'Asia/Jakarta';

export const revalidate = 0; // Disable cache for habit logs

const iconMap: Record<string, any> = {
  WAKE_UP: Sun,
  SLEEP: Moon,
  START_WORK: LogIn,
  STOP_WORK: LogOut,
  START_STUDY: GraduationCap,
  STOP_STUDY: GraduationCap,
  EXERCISE: Activity,
  TIME_SINK: MonitorPlay
};

const labelMap: Record<string, string> = {
  WAKE_UP: 'Bangun Tidur',
  SLEEP: 'Mulai Tidur',
  START_WORK: 'Mulai Kerja',
  STOP_WORK: 'Selesai Kerja',
  START_STUDY: 'Mulai Belajar',
  STOP_STUDY: 'Selesai Belajar',
  EXERCISE: 'Olahraga',
  TIME_SINK: 'Screen Time / Santai'
};

export default async function HabitsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;

  let logs: any[] = [];
  let todaySummary = { work: 0, screenTime: 0 };

  if (userId) {
    const { data } = await supabase
      .from('habit_logs')
      .select('*')
      .eq('user_id', userId)
      .order('logged_at', { ascending: false })
      .limit(100);

    logs = data || [];
  }

  // Filter logs berdasarkan tanggal WIB, bukan UTC server
  const nowInWIB = toZonedTime(new Date(), TZ);
  const todayLogs = logs.filter(l => isSameDay(toZonedTime(new Date(l.logged_at), TZ), nowInWIB));

  // Calculate some simple summaries if we have pairs
  // For V1, we'll just show the raw logs as a timeline

  return (
    <div className="h-full flex flex-col bg-surface overflow-hidden">
      {/* Header */}
      <header className="px-6 flex justify-between items-center mb-6 shrink-0 mt-2">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-on-surface">Habit Tracker</h1>
          <p className="text-secondary text-sm mt-1">Pantau rutinitas harianmu</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 pb-24 space-y-8">
        
        {/* Ringkasan Hari Ini */}
        <section>
          <h2 className="text-lg font-bold text-on-surface mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" /> Ringkasan Hari Ini
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-surface-bright border border-surface-variant rounded-[20px] p-4 shadow-sm">
              <p className="text-xs text-secondary font-medium mb-1">Aktivitas Tercatat</p>
              <p className="text-2xl font-extrabold text-on-surface">{todayLogs.length}</p>
            </div>
            <div className="bg-surface-bright border border-surface-variant rounded-[20px] p-4 shadow-sm">
              <p className="text-xs text-secondary font-medium mb-1">Log Terakhir</p>
              <p className="text-sm font-bold text-on-surface truncate">
                {todayLogs.length > 0 
                  ? labelMap[todayLogs[0].habit_type] || todayLogs[0].habit_type
                  : '-'}
              </p>
              <p className="text-xs text-secondary">
                {todayLogs.length > 0 ? formatInTimeZone(new Date(todayLogs[0].logged_at), TZ, 'HH:mm') : ''}
              </p>
            </div>
          </div>
        </section>

        {/* Timeline Harian */}
        <section>
          <h2 className="text-lg font-bold text-on-surface mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" /> Timeline Hari Ini
          </h2>
          <div className="bg-surface-bright border border-surface-variant rounded-[20px] p-5 shadow-sm relative">
            {todayLogs.length === 0 ? (
              <p className="text-sm text-secondary text-center py-4">Belum ada catatan hari ini.</p>
            ) : (
              <div className="flex flex-col gap-0 relative">
                {/* Vertical Line */}
                <div className="absolute left-[19px] top-4 bottom-4 w-[2px] bg-surface-variant z-0"></div>
                
                {todayLogs.map((log, index) => {
                  const Icon = iconMap[log.habit_type] || Activity;
                  return (
                    <div key={log.id} className="relative z-10 flex gap-4 py-3 items-start">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex-shrink-0 flex items-center justify-center text-primary mt-1 border-[3px] border-surface-bright">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <p className="font-bold text-on-surface text-sm">
                            {labelMap[log.habit_type] || log.habit_type}
                            {log.custom_label && <span className="font-normal text-secondary ml-1">({log.custom_label})</span>}
                          </p>
                          <span className="text-xs font-bold text-secondary bg-surface-container px-2 py-1 rounded-full whitespace-nowrap ml-2">
                            {formatInTimeZone(new Date(log.logged_at), TZ, 'HH:mm')}
                          </span>
                        </div>
                        {log.notes && <p className="text-xs text-secondary mt-1">{log.notes}</p>}
                        {log.duration_minutes && <p className="text-xs text-primary font-medium mt-1">Durasi: {log.duration_minutes} menit</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Grafik Tren Mingguan */}
        <section>
          <HabitTrendChart logs={logs} />
        </section>

        {/* Riwayat Lengkap & Edit */}
        <section>
          <HabitLogHistory logs={logs} labelMap={labelMap} />
        </section>

      </div>
    </div>
  );
}
