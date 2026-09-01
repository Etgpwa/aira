import { createClient } from '@/lib/supabase/server';
import { GraduationCap, BookOpen, Clock, FileText, ChevronRight, Activity } from 'lucide-react';
import Link from 'next/link';
import QuizSimulator from './components/QuizSimulator';
import ManualQuizInput from './components/ManualQuizInput';

export const revalidate = 0; // pastikan selalu fresh

export default async function AcademicPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;

  let schedules: any[] = [];
  let targets: any[] = [];
  let questions: any[] = [];

  if (userId) {
    const [schedRes, targetRes, questRes] = await Promise.all([
      supabase.from('course_schedules').select('*').eq('user_id', userId).order('day_of_week', { ascending: true }),
      supabase.from('course_weekly_targets').select('*').eq('user_id', userId).order('week_number', { ascending: false }),
      supabase.from('course_quiz_questions').select('*').eq('user_id', userId)
    ]);
    if (schedRes.data) schedules = schedRes.data;
    if (targetRes.data) targets = targetRes.data;
    if (questRes.data) questions = questRes.data;
  }

  // Hitung persentase progress materi minggu ini
  const completedTargets = targets.filter(t => t.is_completed).length;
  const totalTargets = targets.length;
  const progressPct = totalTargets > 0 ? Math.round((completedTargets / totalTargets) * 100) : 0;
  
  // Kelompokkan jadwal hari ini
  const todayDay = new Date().getDay();
  const todaySchedules = schedules.filter(s => s.day_of_week === todayDay);
  const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  return (
    <div className="p-6 pt-8 pb-32 min-h-screen bg-surface">
      {/* Header */}
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-on-surface">Akademik</h1>
          <p className="text-secondary text-sm mt-1">Dashboard Kuliah & Belajar</p>
        </div>
        <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-primary relative">
          <GraduationCap className="w-5 h-5" />
        </div>
      </header>

      {/* Hero Stats Card */}
      <section className="mb-8">
        <div className="bg-accent-gradient rounded-[24px] p-6 text-on-primary shadow-[0_12px_24px_rgba(56,74,216,0.25)] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full blur-xl translate-y-1/2 -translate-x-1/2"></div>
          
          <div className="relative z-10 flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-white/80 text-sm font-medium mb-1">Target Materi</p>
                <h2 className="text-3xl font-extrabold tracking-tight">{progressPct}%</h2>
              </div>
              <div className="text-right">
                <p className="text-white/80 text-sm font-medium mb-1">Total Soal Kuis</p>
                <h2 className="text-2xl font-extrabold tracking-tight">{questions.length}</h2>
              </div>
            </div>
            
            <div className="w-full bg-black/20 rounded-full h-2.5 overflow-hidden">
                <div className="bg-white h-full rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }}></div>
            </div>
          </div>
        </div>
      </section>

      {/* Jadwal Kuliah Hari Ini */}
      <section className="mb-8">
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" /> Kuliah Hari Ini ({dayNames[todayDay]})
            </h3>
        </div>
        
        {todaySchedules.length > 0 ? (
            <div className="flex flex-col gap-3">
                {todaySchedules.map((s, i) => (
                    <div key={i} className="bg-surface-bright border border-surface-variant rounded-[16px] p-4 flex justify-between items-center shadow-sm">
                        <div>
                            <h4 className="font-bold text-on-surface">{s.subject_name}</h4>
                            <p className="text-xs text-secondary mt-1">{s.lecturer || 'Dosen TBA'} • R. {s.room || '-'}</p>
                        </div>
                        <div className="text-right">
                            <span className="inline-block bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold">
                                {s.start_time.slice(0,5)} - {s.end_time.slice(0,5)}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        ) : (
            <div className="bg-surface-container rounded-[16px] p-6 text-center">
                <p className="text-secondary text-sm">Tidak ada jadwal kuliah hari ini. Waktunya istirahat atau nugas!</p>
            </div>
        )}
      </section>

      {/* Simulasi Kuis Interaktif */}
      <section className="mb-8">
          <QuizSimulator questions={questions} />
      </section>

      {/* Input Soal Manual */}
      <section>
          <ManualQuizInput userId={userId || ''} />
      </section>

    </div>
  );
}
