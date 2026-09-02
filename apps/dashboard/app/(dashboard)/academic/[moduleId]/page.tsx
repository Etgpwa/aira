import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { ArrowLeft, BookOpen, CheckCircle2, Trophy, FileText, Play } from 'lucide-react';
import Link from 'next/link';
import QuestionList from './components/QuestionList';
import QuizRunner from './components/QuizRunner';
import OcrUploadPanel from './components/OcrUploadPanel';

export const revalidate = 0;

export default async function ModuleDetailPage({ params }: { params: { moduleId: string } }) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return notFound();

    const { data: module } = await supabase
        .from('course_modules')
        .select('*')
        .eq('id', params.moduleId)
        .eq('user_id', user.id)
        .single();

    if (!module) return notFound();

    const { data: questions } = await supabase
        .from('course_quiz_questions')
        .select('*')
        .eq('module_id', params.moduleId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

    const questionList = questions || [];
    const mcqCount = questionList.filter(q => q.question_type === 'MCQ').length;

    return (
        <div className="min-h-screen bg-surface">
            {/* Sticky Header */}
            <div className="sticky top-0 z-20 bg-surface/90 backdrop-blur-md border-b border-surface-variant px-4 py-3 flex items-center gap-3">
                <Link href="/academic" className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-secondary outline-none">
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <div className="flex-1 min-w-0">
                    <p className="text-xs text-secondary font-medium truncate">{module.subject_name} · {module.module_title}</p>
                    <p className="font-bold text-on-surface text-sm truncate">{module.kb_title}</p>
                </div>
                {module.is_completed && (
                    <div className="flex items-center gap-1 bg-mint-bg/30 text-mint-fg px-2 py-1 rounded-full flex-shrink-0">
                        <Trophy className="w-3.5 h-3.5" />
                        <span className="text-xs font-bold">{module.best_score}</span>
                    </div>
                )}
            </div>

            {/* Status Banner */}
            <div className="px-4 pt-5">
                {module.is_completed ? (
                    <div className="bg-mint-bg/20 border border-mint-bg rounded-[16px] p-4 flex items-center gap-3 mb-5">
                        <CheckCircle2 className="w-6 h-6 text-mint-fg flex-shrink-0" />
                        <div>
                            <p className="font-bold text-mint-fg">KB ini sudah diselesaikan!</p>
                            <p className="text-xs text-mint-fg/70">Skor terbaik: {module.best_score ?? '-'}. Kamu bisa ulangi simulasi untuk meningkatkan skor.</p>
                        </div>
                    </div>
                ) : (
                    <div className="bg-primary/5 border border-primary/20 rounded-[16px] p-4 flex items-center gap-3 mb-5">
                        <BookOpen className="w-6 h-6 text-primary flex-shrink-0" />
                        <div>
                            <p className="font-bold text-on-surface">{questionList.length} soal tersedia</p>
                            <p className="text-xs text-secondary">{mcqCount} MCQ siap untuk simulasi kuis</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Desktop 2-column / Mobile single-column */}
            <div className="px-4 pb-6 lg:grid lg:grid-cols-[1fr_400px] lg:gap-8 lg:items-start">

                {/* Kolom Kiri: Kelola Soal + Bank Soal */}
                <div>
                    {/* Section: Upload OCR */}
                    <section className="mb-6">
                        <h3 className="text-sm font-bold text-secondary uppercase tracking-wider mb-3 flex items-center gap-2">
                            <FileText className="w-4 h-4" /> Kelola Soal
                        </h3>
                        <OcrUploadPanel moduleId={params.moduleId} subjectName={module.subject_name} />
                    </section>

                    {/* Section: List Soal */}
                    {questionList.length > 0 && (
                        <section>
                            <h3 className="text-sm font-bold text-secondary uppercase tracking-wider mb-3">
                                Bank Soal ({questionList.length})
                            </h3>
                            <QuestionList questions={questionList} moduleId={params.moduleId} />
                        </section>
                    )}

                    {questionList.length === 0 && (
                        <div className="bg-surface-container rounded-[20px] p-8 text-center">
                            <p className="text-secondary text-sm">Belum ada soal. Scan foto modul atau tambah soal manual di atas.</p>
                        </div>
                    )}
                </div>

                {/* Kolom Kanan: Simulasi Kuis — sticky di desktop */}
                {mcqCount > 0 && (
                    <div className="mt-6 lg:mt-0 lg:sticky lg:top-[68px]">
                        <h3 className="text-sm font-bold text-secondary uppercase tracking-wider mb-3 flex items-center gap-2">
                            <Play className="w-4 h-4" /> Simulasi Kuis
                        </h3>
                        <QuizRunner
                            questions={questionList.filter(q => q.question_type === 'MCQ')}
                            moduleId={params.moduleId}
                            isAlreadyCompleted={module.is_completed}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
