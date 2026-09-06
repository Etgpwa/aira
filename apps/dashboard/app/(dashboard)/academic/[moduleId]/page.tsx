import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { ArrowLeft, BookOpen, CheckCircle2, Trophy, FileText, Play, ChevronRight, Sparkles } from 'lucide-react';
import Link from 'next/link';
import QuestionList from './components/QuestionList';
import OcrUploadPanel from './components/OcrUploadPanel';
import ModuleHeaderActions from './components/ModuleHeaderActions';

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
            {/* Sticky Header dengan Tombol Edit & Hapus KB di Pojok Kanan Atas */}
            <div className="sticky top-0 z-20 bg-surface/90 backdrop-blur-md border-b border-surface-variant px-4 py-3 flex items-center gap-3">
                <Link href="/academic" className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-secondary hover:text-on-surface outline-none">
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <div className="flex-1 min-w-0">
                    <p className="text-xs text-secondary font-medium truncate">{module.subject_name} · {module.module_title}</p>
                    <p className="font-bold text-on-surface text-sm truncate">{module.kb_title}</p>
                </div>

                {module.is_completed && (
                    <div className="flex items-center gap-1 bg-mint-bg/30 text-mint-fg px-2.5 py-1 rounded-full flex-shrink-0">
                        <Trophy className="w-3.5 h-3.5" />
                        <span className="text-xs font-bold">{module.best_score}</span>
                    </div>
                )}

                {/* Aksi Header: Edit & Hapus KB */}
                <ModuleHeaderActions
                    moduleId={params.moduleId}
                    initialSubject={module.subject_name}
                    initialModuleTitle={module.module_title}
                    initialKbTitle={module.kb_title}
                    questionCount={questionList.length}
                />
            </div>

            {/* Kartu Status & Pemicu Simulasi Kuis (Membuka Halaman Kuis Terpisah) */}
            <div className="px-4 pt-5 pb-2">
                {/* Banner Simulasi Kuis */}
                {mcqCount > 0 ? (
                    <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-surface-bright border border-primary/25 rounded-[22px] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 shadow-sm">
                        <div className="flex items-start gap-3.5">
                            <div className="w-12 h-12 rounded-[16px] bg-primary text-on-primary flex items-center justify-center flex-shrink-0 shadow-md shadow-primary/20">
                                <Play className="w-6 h-6 fill-on-primary translate-x-0.5" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="font-extrabold text-base text-on-surface">Simulasi Kuis Mandiri</h2>
                                    {module.is_completed && (
                                        <span className="text-[10px] bg-mint-bg/30 text-mint-fg font-bold px-2 py-0.5 rounded-full">
                                            Selesai (Skor: {module.best_score})
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-secondary mt-0.5 leading-relaxed">
                                    Tersedia <strong>{mcqCount} soal MCQ</strong>. Uji pemahaman materi ini dalam tampilan ujian fokus di halaman khusus.
                                </p>
                            </div>
                        </div>

                        <Link
                            href={`/academic/${params.moduleId}/quiz`}
                            className="bg-primary hover:bg-primary-container text-on-primary px-5 py-3 rounded-full font-bold text-sm flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(56,74,216,0.25)] active:scale-95 transition-all flex-shrink-0"
                        >
                            <span>{module.is_completed ? 'Ulangi Kuis' : 'Mulai Simulasi Kuis'}</span>
                            <ChevronRight className="w-4 h-4" />
                        </Link>
                    </div>
                ) : (
                    <div className="bg-surface-bright border border-surface-variant rounded-[18px] p-4 flex items-center gap-3.5 mb-5">
                        <div className="w-10 h-10 rounded-2xl bg-surface-container flex items-center justify-center text-secondary flex-shrink-0">
                            <BookOpen className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <p className="font-bold text-on-surface text-sm">{questionList.length} Soal Tersimpan</p>
                            <p className="text-xs text-secondary">
                                Scan foto modul atau tambahkan soal pilihan ganda (MCQ) di bawah untuk membuka simulasi kuis.
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Area Kelola Soal & Bank Soal */}
            <div className="px-4 pb-8 max-w-4xl mx-auto">
                {/* Section: Upload OCR & Input Manual */}
                <section className="mb-6">
                    <h3 className="text-sm font-bold text-secondary uppercase tracking-wider mb-3 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-primary" /> Kelola & Scan Soal
                    </h3>
                    <OcrUploadPanel moduleId={params.moduleId} subjectName={module.subject_name} />
                </section>

                {/* Section: List Soal di Bank Soal */}
                {questionList.length > 0 ? (
                    <section>
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-sm font-bold text-secondary uppercase tracking-wider">
                                Bank Soal ({questionList.length})
                            </h3>
                            <span className="text-xs text-secondary font-medium">
                                {mcqCount} Pilihan Ganda · {questionList.length - mcqCount} Essay
                            </span>
                        </div>
                        <QuestionList questions={questionList} moduleId={params.moduleId} />
                    </section>
                ) : (
                    <div className="bg-surface-container rounded-[20px] p-8 text-center border border-surface-variant">
                        <p className="text-secondary text-sm">Belum ada soal. Scan foto modul atau tambah soal manual di atas.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
