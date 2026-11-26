import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import QuizImages, { hasQuizImage } from '../components/QuizImages';
import type { QuizBankQuestion } from '../quiz-bank';
import QuestionNote from './QuestionNote';

export const revalidate = 0;

const PAGE_SIZE = 12;
const OPTIONS = ['option_a', 'option_b', 'option_c', 'option_d'] as const;
type StudyQuestion = QuizBankQuestion & {
    subject_name: string | null;
    course_modules: { subject_name: string; module_title: string; kb_title: string } | null;
};

function pageHref(subject: string, page = 1) {
    const params = new URLSearchParams();
    if (subject) params.set('matkul', subject);
    if (page > 1) params.set('halaman', String(page));
    const query = params.toString();
    return query ? `/academic/kisi-kisi?${query}` : '/academic/kisi-kisi';
}

export default async function KisiKisiPage({ searchParams }: {
    searchParams?: { matkul?: string; halaman?: string };
}) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return notFound();

    const { data: modules, error: moduleError } = await supabase.from('course_modules')
        .select('id, subject_name').eq('user_id', user.id).order('subject_name');
    if (moduleError) throw moduleError;
    const subjects = Array.from(new Set((modules ?? []).map(item => item.subject_name).filter(Boolean)));
    const subject = typeof searchParams?.matkul === 'string' && subjects.includes(searchParams.matkul) ? searchParams.matkul : '';
    const parsedPage = Number(searchParams?.halaman);
    const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 && Number.isSafeInteger(parsedPage * PAGE_SIZE) ? parsedPage : 1;
    const offset = (page - 1) * PAGE_SIZE;

    let query = supabase.from('course_quiz_questions')
        .select('*, course_modules(subject_name, module_title, kb_title)', { count: 'exact' })
        .eq('user_id', user.id);
    if (subject) {
        const moduleIds = (modules ?? []).filter(item => item.subject_name === subject).map(item => item.id);
        query = query.or(`module_id.in.(${moduleIds.join(',')}),and(module_id.is.null,subject_name.eq.${JSON.stringify(subject)})`);
    }
    const { data, count, error } = await query
        .order('module_id', { nullsFirst: false }).order('created_at').order('id')
        .range(offset, offset + PAGE_SIZE - 1);
    const total = count ?? 0;
    const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (page > lastPage && count !== null) redirect(pageHref(subject, lastPage));
    if (error) throw error;
    const questions = (data ?? []) as unknown as StudyQuestion[];

    return (
        <main className="mx-auto w-full max-w-3xl space-y-4 px-3 pb-24 pt-3 sm:px-5">
            <header className="flex items-start gap-3">
                <Link href="/academic" aria-label="Kembali ke Akademik"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface">
                    <ArrowLeft className="h-4 w-4" />
                </Link>
                <div>
                    <h1 className="text-xl font-extrabold text-on-surface">Kisi-kisi</h1>
                    <p className="text-sm text-secondary">Baca soal dan kunci jawaban, lalu simpan penjelasanmu di catatan.</p>
                </div>
            </header>

            <nav aria-label="Saring berdasarkan mata kuliah" className="flex flex-wrap gap-2">
                {['', ...subjects].map(name => (
                    <Link key={name} href={pageHref(name)} prefetch={false}
                        aria-current={subject === name ? 'page' : undefined}
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${subject === name
                            ? 'border-primary bg-primary/10 text-primary' : 'border-surface-variant bg-surface-bright text-on-surface'}`}>
                        {name || 'Semua mata kuliah'}
                    </Link>
                ))}
            </nav>

            {questions.length ? (
                <>
                    <p className="text-xs font-semibold text-secondary">
                        Soal {offset + 1}–{offset + questions.length} dari {total}
                    </p>
                    {questions.map((question, index) => {
                        const key = question.correct_answer?.trim();
                        const gradedOption = question.question_type === 'MCQ' && /^[A-D]$/i.test(key ?? '') ? key?.toUpperCase() : null;
                        const hasSolutionImage = hasQuizImage(question.ocr_images, 'correct_answer');
                        const explicitKey = key && key !== '?' ? key : null;
                        const module = question.course_modules;
                        return (
                            <article key={question.id} className="grid gap-3 rounded-2xl border border-surface-variant bg-surface-bright p-4 text-on-surface">
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-secondary">
                                    <span className="font-bold text-primary">Soal {question.source_number ?? offset + index + 1}</span>
                                    <span>{[module?.subject_name ?? question.subject_name, module?.module_title, module?.kb_title].filter(Boolean).join(' · ')}</span>
                                </div>
                                <div>
                                    <p className="whitespace-pre-wrap break-words text-sm font-medium leading-relaxed">{question.question_text}</p>
                                    <QuizImages images={question.ocr_images} field="question_text" />
                                </div>
                                {question.question_type === 'MCQ' && (
                                    <ul className="grid gap-1.5 text-sm">
                                        {OPTIONS.map((field, index) => {
                                            const letter = 'ABCD'[index];
                                            const isKey = letter === gradedOption;
                                            if (!question[field] && !hasQuizImage(question.ocr_images, field) && !isKey) return null;
                                            return (
                                                <li key={field} className={`flex min-w-0 gap-2 rounded-lg px-2.5 py-1.5 ${isKey ? 'bg-mint-bg/40 text-mint-fg' : 'bg-surface-container/50'}`}>
                                                    <span className="font-bold">{letter}.</span>
                                                    <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">
                                                        {question[field]}
                                                        <QuizImages images={question.ocr_images} field={field} />
                                                    </span>
                                                    {isKey && <span className="shrink-0 self-start text-xs font-bold">Kunci jawaban</span>}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                                {(!gradedOption || hasSolutionImage) && (
                                    <div className="rounded-xl bg-mint-bg/30 p-3 text-sm">
                                        <p className="mb-1 text-xs font-bold text-mint-fg">{gradedOption ? 'Gambar solusi' : 'Kunci jawaban'}</p>
                                        {!gradedOption && explicitKey && <p className="whitespace-pre-wrap break-words">{explicitKey}</p>}
                                        {!explicitKey && !hasSolutionImage && <p className="text-secondary">Belum tersedia.</p>}
                                        <QuizImages images={question.ocr_images} field="correct_answer" />
                                    </div>
                                )}
                                <QuestionNote questionId={question.id} note={question.user_note ?? ''} />
                            </article>
                        );
                    })}
                    {lastPage > 1 && (
                        <nav aria-label="Halaman soal" className="grid grid-cols-3 items-center gap-1 text-xs font-semibold text-secondary">
                            <div>{page > 1 && <Link prefetch={false} href={pageHref(subject, page - 1)} className="inline-flex items-center gap-1 text-primary">
                                <ChevronLeft className="h-4 w-4" /> Sebelumnya
                            </Link>}</div>
                            <span className="text-center">Halaman {page} / {lastPage}</span>
                            <div className="text-right">{page < lastPage && <Link prefetch={false} href={pageHref(subject, page + 1)} className="inline-flex items-center gap-1 text-primary">
                                Berikutnya <ChevronRight className="h-4 w-4" />
                            </Link>}</div>
                        </nav>
                    )}
                </>
            ) : (
                <div className="grid justify-items-center gap-2 rounded-2xl border border-surface-variant bg-surface-bright p-8 text-center text-sm text-secondary">
                    <BookOpen className="h-6 w-6 text-primary" />
                    <p>Belum ada soal di bank soal{subject ? ` ${subject}` : ''}.</p>
                </div>
            )}
        </main>
    );
}
