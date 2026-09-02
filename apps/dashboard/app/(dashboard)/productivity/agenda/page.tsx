import { createClient } from '@/lib/supabase/server';
import { Calendar, Plus } from 'lucide-react';
import DeleteScheduleButton from '@/components/DeleteScheduleButton';

const DAYS = [
  { id: 1, name: 'Senin', short: 'Sen' },
  { id: 2, name: 'Selasa', short: 'Sel' },
  { id: 3, name: 'Rabu', short: 'Rab' },
  { id: 4, name: 'Kamis', short: 'Kam' },
  { id: 5, name: 'Jumat', short: 'Jum' },
  { id: 6, name: 'Sabtu', short: 'Sab' },
  { id: 0, name: 'Minggu', short: 'Min' }
];

export const revalidate = 30;

export default async function SchedulePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;

  let schedules: any[] = [];
  const currentDayId = new Date().getDay(); // 0-6

  if (userId) {
    const { data } = await supabase
      .from('study_schedules')
      .select('*')
      .eq('user_id', userId)
      .order('start_time', { ascending: true });
    
    schedules = data || [];
  }

  return (
    <div className="h-full flex flex-col bg-surface overflow-hidden">
      {/* Header */}
      <header className="px-6 flex justify-between items-center mb-6 shrink-0">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-on-surface">Jadwal</h1>
          <p className="text-secondary text-sm mt-1">Agenda rutinitas & kelasmu</p>
        </div>
        <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-primary relative shadow-sm">
          <Plus className="w-5 h-5" />
        </div>
      </header>
      
      {/* Scrollable Container (Horizontal) */}
      <div className="flex-1 w-full overflow-x-auto snap-x snap-mandatory scrollbar-hide px-5">
        <div className="flex gap-4 h-full min-w-max pb-4">
          {DAYS.map(day => {
            const daySchedules = schedules.filter(s => s.day_of_week === day.id);
            const isToday = day.id === currentDayId;
            
            return (
              <div key={day.id} className="w-[280px] shrink-0 h-full flex flex-col snap-center">
                {/* Header Kolom Hari */}
                <div className="flex items-center justify-between mb-4 px-1 shrink-0">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${isToday ? 'bg-primary text-white' : 'bg-surface-container text-secondary'}`}>
                      {day.short}
                    </div>
                    <h2 className={`font-bold ${isToday ? 'text-primary' : 'text-on-surface'}`}>
                      {day.name}
                    </h2>
                  </div>
                  <span className="text-xs font-bold text-secondary bg-surface-container px-2 py-0.5 rounded-full">{daySchedules.length}</span>
                </div>

                {/* List Jadwal per Hari */}
                <div className="flex-1 overflow-y-auto scrollbar-hide pb-20 px-1 flex flex-col gap-3">
                  {daySchedules.map(schedule => (
                    <div key={schedule.id} className={`p-4 rounded-[20px] border shadow-[0_8px_24px_rgba(24,26,42,0.03)] flex flex-col relative ${isToday ? 'bg-primary/5 border-primary/20' : 'bg-surface-bright border-surface-variant'}`}>
                      
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-1.5 bg-surface-container px-2 py-1 rounded-md text-[10px] font-bold text-secondary">
                          <Calendar className="w-3 h-3" />
                          {schedule.start_time.slice(0, 5)} - {schedule.end_time.slice(0, 5)}
                        </div>
                        <DeleteScheduleButton scheduleId={schedule.id} subject={schedule.subject} />
                      </div>
                      
                      <h3 className="font-extrabold text-sm text-on-surface leading-tight mt-1">
                        {schedule.subject}
                      </h3>
                    </div>
                  ))}

                  {daySchedules.length === 0 && (
                    <div className="border-2 border-dashed border-surface-variant rounded-[20px] p-6 text-center text-secondary text-sm font-medium mt-2">
                      Kosong
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
