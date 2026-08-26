import { createClient } from '@/lib/supabase/server';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import AddScheduleModal from '@/components/AddScheduleModal';
import DeleteScheduleButton from '@/components/DeleteScheduleButton';
import './page.css';

const DAYS = [
  { id: 1, name: 'Senin' },
  { id: 2, name: 'Selasa' },
  { id: 3, name: 'Rabu' },
  { id: 4, name: 'Kamis' },
  { id: 5, name: 'Jumat' },
  { id: 6, name: 'Sabtu' },
  { id: 0, name: 'Minggu' }
];

export default async function SchedulePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;

  let schedules: any[] = [];

  if (userId) {
    const { data } = await supabase
      .from('study_schedules')
      .select('*')
      .eq('user_id', userId)
      .order('start_time', { ascending: true });
    
    schedules = data || [];
  }

  return (
    <div className="schedule-container">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Jadwal Mingguan</h1>
        {userId && <AddScheduleModal userId={userId} />}
      </div>
      
      <div className="schedule-grid">
        {DAYS.map(day => {
          const daySchedules = schedules.filter(s => s.day_of_week === day.id);
          
          return (
            <div key={day.id} className="schedule-day card">
              <h2 className="text-lg font-semibold mb-4 pb-2 border-b" style={{ borderColor: 'var(--border-color)' }}>
                {day.name}
              </h2>
              <div className="schedule-items">
                {daySchedules.map(schedule => (
                  <div key={schedule.id} className="schedule-item flex justify-between items-start">
                    <div>
                      <div className="schedule-time text-accent font-bold text-xs">
                        {schedule.start_time.slice(0, 5)} - {schedule.end_time.slice(0, 5)}
                      </div>
                      <div className="schedule-details mt-1">
                        <h3 className="font-medium text-sm">{schedule.subject}</h3>
                      </div>
                    </div>
                    <DeleteScheduleButton scheduleId={schedule.id} subject={schedule.subject} />
                  </div>
                ))}
                {daySchedules.length === 0 && (
                  <p className="text-sm text-secondary text-center py-2">Kosong</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
