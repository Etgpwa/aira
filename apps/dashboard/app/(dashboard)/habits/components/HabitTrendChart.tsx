'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { format, subDays, isSameDay } from 'date-fns';
import { id } from 'date-fns/locale';
import { Activity } from 'lucide-react';

interface HabitLog {
  logged_at: string;
  duration_minutes: number | null;
  habit_type: string;
}

export default function HabitTrendChart({ logs }: { logs: HabitLog[] }) {
  // Generate last 7 days data
  const data = Array.from({ length: 7 }).map((_, i) => {
    const date = subDays(new Date(), 6 - i);
    const dayLogs = logs.filter(l => isSameDay(new Date(l.logged_at), date));
    
    // Count occurrences for now, or we could sum duration
    return {
      date: format(date, 'EEE', { locale: id }), // e.g. Sen, Sel
      fullDate: format(date, 'dd MMM'),
      count: dayLogs.length,
      duration: dayLogs.reduce((sum, l) => sum + (l.duration_minutes || 0), 0)
    };
  });

  return (
    <div className="bg-surface-bright border border-surface-variant rounded-[20px] p-5 shadow-sm">
      <h3 className="text-sm font-bold text-on-surface mb-4 flex items-center gap-2">
        <Activity className="w-4 h-4 text-primary" /> Tren Aktivitas (7 Hari Terakhir)
      </h3>
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
            <XAxis 
              dataKey="date" 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#6B7280' }} // secondary color approximation
              dy={10}
            />
            <YAxis 
              allowDecimals={false}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#6B7280' }}
            />
            <Tooltip 
              cursor={{ fill: 'rgba(56,74,216,0.05)' }}
              contentStyle={{ borderRadius: '12px', border: '1px solid #E5E7EB', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}
              labelStyle={{ fontWeight: 'bold', color: '#111827', marginBottom: '4px' }}
            />
            <Bar dataKey="count" name="Total Aktivitas" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.count > 0 ? '#384AD8' : '#E5E7EB'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
