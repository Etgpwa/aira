import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { ArrowLeft, Play, Sparkles } from 'lucide-react';
import Link from 'next/link';
import QuizRunner from '../components/QuizRunner';

export const revalidate = 0;

export default async function ModuleQuizPage({ params }: { params: { moduleId: string } }) {
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

    const mcqQuestions = (questions || []).filter(q => q.question_type === 'MCQ');

    return (
        <div className="min-h-screen bg-surface flex flex-col">
            {/* Header Halaman Kuis */}
            <header className="sticky top-0 z-20 bg-surface/90 backdrop-blur-md border-b border-surface-variant px-4 py-3 flex items-center gap-3">
                <Link
                    href={`/academic/${params.moduleId}`}
                    className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-secondary hover:text-on-surface transition-colors"
                    title="Kembali ke Detail KB"
                >
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <div className="flex-1 min-w-0">
                    <p className="text-xs text-secondary font-medium truncate">
                        {module.subject_name} · {module.module_title}
                    </p>
                    <h1 className="font-bold text-on-surface text-sm truncate flex items-center gap-1.5">
                        <Play className="w-3.5 h-3.5 text-primary fill-primary flex-shrink-0" />
                        Simulasi Kuis: {module.kb_title}
                    </h1>
                </div>
            </header>

            {/* Area Utama Kuis */}
            <main className="flex-1 max-w-xl w-full mx-auto p-4 sm:p-6 flex flex-col justify-center">
                {mcqQuestions.length > 0 ? (
                    <QuizRunner
                        questions={mcqQuestions}
                        moduleId={params.moduleId}
                        isAlreadyCompleted={module.is_completed}
                    />
                ) : (
                    <div className="bg-surface-bright border border-surface-variant rounded-[24px] p-8 text-center flex flex-col items-center gap-4 shadow-sm">
                        <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center">
                            <Sparkles className="w-7 h-7" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-on-surface mb-1">Belum Ada Soal Pilihan Ganda</h2>
                            <p className="text-xs text-secondary leading-relaxed max-w-sm">
                                Modul ini belum memiliki soal MCQ (Pilihan Ganda). Silakan scan foto modul atau input soal terlebih dahulu untuk memulai simulasi kuis.
                            </p>
                        </div>
                        <Link
                            href={`/academic/${params.moduleId}`}
                            className="bg-primary text-on-primary px-6 py-2.5 rounded-full font-bold text-sm shadow-md active:scale-95 transition-all"
                        >
                            Scan Soal Sekarang
                        </Link>
                    </div>
                )}
            </main>
        </div>
    );
}
