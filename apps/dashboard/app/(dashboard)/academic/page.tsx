import { createClient } from '@/lib/supabase/server';
import { GraduationCap, Plus, Search, BookOpen, CheckCircle2, Trophy } from 'lucide-react';
import Link from 'next/link';
import CreateModuleModal from './components/CreateModuleModal';
import CourseScheduleSection from './components/CourseScheduleSection';

export const revalidate = 0;

export default async function AcademicPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;

  let modules: any[] = [];
  let allCourseSchedules: any[] = [];
  let todaySchedules: any[] = [];

  if (userId) {
    const todayDay = new Date().getDay();
    let yesterdayDay = todayDay - 1;
    if (yesterdayDay < 0) yesterdayDay = 6;

    const [modRes, schedRes] = await Promise.all([
      supabase
        .from('course_modules')
        .select('*, course_quiz_questions(count)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      supabase
        .from('course_schedules')
        .select('*')
        .eq('user_id', userId)
        .order('day_of_week', { ascending: true })
        .order('start_time', { ascending: true }),
    ]);

    if (modRes.data) {
      modules = modRes.data;
      allCourseSchedules = schedRes.data || [];
      todaySchedules = allCourseSchedules.filter(s => s.day_of_week === yesterdayDay);
    }
  }

  // Stats
  const totalModules = modules.length;
  const completedModules = modules.filter(m => m.is_completed).length;
  const progressPct = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;

  // Rekomendasi: modul belum selesai dari matkul kemarin
  const yesterdaySubjects = todaySchedules.map(s => s.subject_name);
  const recommendations = modules.filter(m =>
    !m.is_completed &&
    yesterdaySubjects.some(s => m.subject_name.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(m.subject_name.toLowerCase()))
  );

  // Kelompokkan modul per matkul untuk tampilan
  const grouped: Record<string, any[]> = {};
  for (const m of modules) {
    if (!grouped[m.subject_name]) grouped[m.subject_name] = [];
    grouped[m.subject_name].push(m);
  }

  return (
    <div className="min-h-screen bg-surface px-1 sm:px-2 space-y-6 pb-16">
      {/* Header */}
      <header className="flex justify-between items-center mb-6 px-1">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-on-surface">Akademik</h1>
          <p className="text-secondary text-sm mt-0.5">Bank Soal & Progress Materi</p>
        </div>
        <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-primary">
          <GraduationCap className="w-5 h-5" />
        </div>
      </header>

      {/* Hero Progress Card */}
      <section className="mb-6">
        <div className="bg-accent-gradient rounded-[24px] p-5 text-white shadow-[0_12px_24px_rgba(56,74,216,0.25)] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative z-10">
            <div className="flex justify-between items-center mb-4">
              <div>
                <p className="text-white/70 text-xs font-medium mb-0.5">Materi Selesai</p>
                <p className="text-3xl font-extrabold">{completedModules}<span className="text-lg text-white/60 font-bold">/{totalModules} KB</span></p>
              </div>
              <div className="text-right">
                <p className="text-white/70 text-xs font-medium mb-0.5">Progress</p>
                <p className="text-3xl font-extrabold">{progressPct}<span className="text-lg text-white/60">%</span></p>
              </div>
            </div>
            <div className="w-full bg-black/20 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-white h-full rounded-full transition-all duration-700"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Jadwal Belajar Aktif & Tunggakan Kuis */}
      <CourseScheduleSection
        schedules={allCourseSchedules}
        modules={modules}
      />

      {/* Tombol Buat KB Baru */}
      <section className="mb-6">
        <CreateModuleModal />
      </section>

      {/* Daftar Semua KB per Matkul */}
      <section>
        {Object.keys(grouped).length === 0 ? (
          <div className="bg-surface-container rounded-[20px] p-8 text-center">
            <BookOpen className="w-10 h-10 text-secondary mx-auto mb-3 opacity-40" />
            <p className="font-bold text-on-surface mb-1">Belum ada Materi</p>
            <p className="text-sm text-secondary">Buat kontainer KB pertamamu di tombol di atas.</p>
          </div>
        ) : (
          Object.entries(grouped).map(([subject, mods]) => (
            <div key={subject} className="mb-6">
              <h3 className="text-sm font-bold text-secondary uppercase tracking-wider mb-3 flex items-center gap-2">
                <BookOpen className="w-4 h-4" /> {subject}
              </h3>
              <div className="flex flex-col gap-2 md:grid md:grid-cols-2 lg:grid-cols-3">
                {mods.map(m => {
                  const qCount = m.course_quiz_questions?.[0]?.count ?? 0;
                  return (
                    <Link
                      key={m.id}
                      href={`/academic/${m.id}`}
                      className="bg-surface-bright border border-surface-variant rounded-[16px] p-4 flex items-center justify-between shadow-sm active:scale-[0.98] transition-transform"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-[12px] flex items-center justify-center flex-shrink-0 ${m.is_completed ? 'bg-mint-bg text-mint-fg' : 'bg-primary/10 text-primary'}`}>
                          {m.is_completed ? <CheckCircle2 className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className="font-bold text-on-surface text-sm leading-tight">{m.kb_title}</p>
                          <p className="text-xs text-secondary mt-0.5">{m.module_title} • {qCount} soal</p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-2">
                        {m.is_completed ? (
                          <div className="flex items-center gap-1">
                            <Trophy className="w-3.5 h-3.5 text-amber-500" />
                            <span className="text-xs font-bold text-amber-600">{m.best_score ?? '-'}</span>
                          </div>
                        ) : (
                          <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
                            Belum
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
