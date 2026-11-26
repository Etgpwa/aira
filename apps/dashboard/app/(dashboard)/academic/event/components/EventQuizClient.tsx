'use client';

import { useState } from 'react';
import {
    ArrowLeft,
    Sparkles,
    CheckSquare,
    Square,
    Play,
    Loader2,
    BookOpen,
    Trophy,
    CheckCircle2
} from 'lucide-react';
import Link from 'next/link';
import QuizRunner from '../../[moduleId]/components/QuizRunner';
import { getEventQuestionBatch, getEventQuestionIds } from '../../actions';
import { EVENT_QUESTION_BATCH_SIZE, EVENT_RANDOM_COUNT, type EventQuestionSelection, type QuizBankQuestion } from '../../quiz-bank';

interface ModuleItem {
    id: string;
    subject_name: string;
    module_title: string;
    kb_title: string;
    is_completed: boolean;
    questions: { count: number }[];
    mcq_questions: { count: number }[];
}

interface EventQuizClientProps {
    modules: ModuleItem[];
}

export default function EventQuizClient({ modules }: EventQuizClientProps) {
    // Kumpulan unik nama mata kuliah
    const subjects = Array.from(new Set(modules.map((m) => m.subject_name))).filter(Boolean);

    const [selectedSubject, setSelectedSubject] = useState<string>(subjects[0] || '');
    const [selectedModuleIds, setSelectedModuleIds] = useState(() => modules
        .filter(module => module.subject_name === subjects[0]).map(module => module.id));
    const [chosenMode, setChosenMode] = useState<'normal' | 'challenge'>('normal');
    const [selection, setSelection] = useState<EventQuestionSelection>('random');

    // State saat proses loading & menjalankan ujian
    const [isLoading, setIsLoading] = useState(false);
    const [loadingStep, setLoadingStep] = useState<string>('');
    const [activeExamQuestions, setActiveExamQuestions] = useState<QuizBankQuestion[] | null>(null);
    const [loadError, setLoadError] = useState('');

    // Filter KB berdasarkan matkul yang aktif dipilih
    const subjectModules = modules.filter((m) => m.subject_name === selectedSubject);

    const questionCount = (module: ModuleItem) => (selection === 'all' ? module.questions : module.mcq_questions)?.[0]?.count ?? 0;
    const selectedTotalQuestions = subjectModules
        .filter((m) => selectedModuleIds.includes(m.id))
        .reduce((sum, m) => sum + questionCount(m), 0);
    const examSize = selection === 'all' ? selectedTotalQuestions : Math.min(EVENT_RANDOM_COUNT, selectedTotalQuestions);

    const handleSelectAll = () => {
        setSelectedModuleIds(subjectModules.map((m) => m.id));
    };

    const handleDeselectAll = () => {
        setSelectedModuleIds([]);
    };

    const toggleModule = (id: string) => {
        setSelectedModuleIds((prev) =>
            prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
        );
    };

    // Mulai Ujian Event
    const handleStartEvent = async () => {
        if (selectedModuleIds.length === 0 || examSize === 0 || isLoading) return;

        setIsLoading(true);
        setLoadError('');
        setLoadingStep('Menyiapkan daftar soal…');

        try {
            const ids = await getEventQuestionIds(selectedModuleIds, selection);
            const questions: QuizBankQuestion[] = [];
            for (let offset = 0; offset < ids.length;) {
                const batch = await getEventQuestionBatch(ids.slice(offset, offset + EVENT_QUESTION_BATCH_SIZE));
                questions.push(...batch.questions);
                offset += batch.consumed;
                setLoadingStep(`Memuat soal ${offset} dari ${ids.length}…`);
            }

            if (questions.length === 0) {
                setLoadError('Belum ada soal yang tersedia di KB terpilih untuk paket ini.');
                return;
            }
            setActiveExamQuestions(questions);
        } catch (err) {
            console.error('Gagal memulai ujian event:', err);
            setLoadError('Gagal memuat soal. Coba lagi.');
        } finally {
            setIsLoading(false);
            setLoadingStep('');
        }
    };

    // ─── Tampilan 1: CBT Quiz Sedang Aktif ─────────────────────────
    if (activeExamQuestions) {
        return (
            <div className="min-h-screen bg-surface flex flex-col">
                <header className="sticky top-0 z-20 bg-surface/95 backdrop-blur-md border-b border-surface-variant px-4 py-2.5 sm:py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setActiveExamQuestions(null)}
                            className="w-8 h-8 rounded-full bg-surface-container hover:bg-surface-variant flex items-center justify-center text-secondary hover:text-on-surface transition-colors shrink-0"
                            title="Konfigurasi Ulang Event"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </button>
                        <div>
                            <p className="text-[11px] text-secondary font-semibold leading-none mb-0.5">
                                Mode Event · {selectedSubject}
                            </p>
                            <h1 className="font-extrabold text-on-surface text-sm truncate flex items-center gap-1.5">
                                <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                Simulasi UTS / UAS Mandiri ({activeExamQuestions.length} Soal)
                            </h1>
                        </div>
                    </div>

                </header>

                <main className="w-full max-w-2xl mx-auto px-3.5 sm:px-4 pt-3 pb-8 flex-1">
                    <QuizRunner
                        questions={activeExamQuestions}
                        isEventMode={true}
                        initialMode={chosenMode}
                    />
                </main>
            </div>
        );
    }

    // ─── Tampilan 2: Form Konfigurasi Simulasi Event ───────────────
    return (
        <fieldset disabled={isLoading} className="min-h-screen min-w-0 bg-surface px-3 sm:px-4 py-4 max-w-3xl mx-auto space-y-6 pb-20">
            {/* Header */}
            <div className="flex items-center gap-3">
                <Link
                    href="/academic"
                    className="w-9 h-9 rounded-full bg-surface-container hover:bg-surface-variant flex items-center justify-center text-secondary hover:text-on-surface transition-colors shrink-0"
                >
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <div>
                    <h1 className="text-xl font-extrabold text-on-surface tracking-tight flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-amber-500" />
                        Mode Event: Simulasi UTS / UAS
                    </h1>
                    <p className="text-xs text-secondary mt-0.5">
                        Pilih paket acak atau gunakan seluruh bank soal dari KB terpilih.
                    </p>
                </div>
            </div>

            {/* Langkah 1: Pilih Mata Kuliah */}
            <section className="bg-surface-bright border border-surface-variant rounded-[20px] p-4 sm:p-5 shadow-xs flex flex-col gap-3">
                <label className="text-xs font-bold text-secondary uppercase tracking-wider">
                    Langkah 1 · Pilih Mata Kuliah
                </label>
                {subjects.length === 0 ? (
                    <p className="text-xs text-secondary">Belum ada mata kuliah yang terdaftar.</p>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {subjects.map((subj) => (
                            <button
                                key={subj}
                                type="button"
                                onClick={() => {
                                    setSelectedSubject(subj);
                                    setSelectedModuleIds(modules.filter(module => module.subject_name === subj).map(module => module.id));
                                }}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                    selectedSubject === subj
                                        ? 'bg-primary text-on-primary shadow-xs scale-[1.02]'
                                        : 'bg-surface-container hover:bg-surface-variant text-on-surface'
                                }`}
                            >
                                {subj}
                            </button>
                        ))}
                    </div>
                )}
            </section>

            {/* Langkah 2: Checklist KB (Materi yang Ingin Diujikan) */}
            <section className="bg-surface-bright border border-surface-variant rounded-[20px] p-4 sm:p-5 shadow-xs flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                        <label className="text-xs font-bold text-secondary uppercase tracking-wider">
                            Langkah 2 · Pilih Cakupan Materi (KB)
                        </label>
                        <p className="text-xs text-secondary mt-0.5">
                            Centang materi yang ingin dimasukkan ke dalam paket ujian
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleSelectAll}
                            className="text-xs font-bold text-primary hover:underline"
                        >
                            Pilih Semua KB
                        </button>
                        <span className="text-secondary text-xs">•</span>
                        <button
                            type="button"
                            onClick={handleDeselectAll}
                            className="text-xs font-bold text-secondary hover:text-on-surface"
                        >
                            Batal Pilih
                        </button>
                    </div>
                </div>

                {subjectModules.length === 0 ? (
                    <div className="bg-surface-container rounded-xl p-4 text-center text-xs text-secondary">
                        Tidak ada materi KB untuk mata kuliah ini.
                    </div>
                ) : (
                    <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">
                        {subjectModules.map((m) => {
                            const isChecked = selectedModuleIds.includes(m.id);
                            const qCount = questionCount(m);

                            return (
                                <button
                                    key={m.id}
                                    type="button"
                                    aria-pressed={isChecked}
                                    onClick={() => toggleModule(m.id)}
                                    className={`flex items-center justify-between p-3 rounded-xl border transition-all text-left ${
                                        isChecked
                                            ? 'border-primary bg-primary/10 text-on-surface'
                                            : 'border-surface-variant bg-surface hover:border-primary/30 text-secondary'
                                    }`}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        {isChecked ? (
                                            <CheckSquare className="w-5 h-5 text-primary shrink-0" />
                                        ) : (
                                            <Square className="w-5 h-5 text-secondary shrink-0" />
                                        )}
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold text-on-surface truncate leading-tight">
                                                {m.kb_title}
                                            </p>
                                            <p className="text-[11px] text-secondary truncate mt-0.5">
                                                {m.module_title}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0 ml-2">
                                        <span className="text-[11px] font-bold bg-surface-container px-2 py-0.5 rounded-full text-secondary">
                                            {qCount} soal{selection === 'random' ? ' pilihan ganda' : ''}
                                        </span>
                                        {m.is_completed && (
                                            <CheckCircle2 className="w-4 h-4 text-mint-fg shrink-0" />
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Ringkasan Seleksi Soal */}
                <div className="bg-surface-container/60 border border-surface-variant rounded-xl p-3 flex items-center justify-between text-xs">
                    <span className="text-secondary font-medium">Soal tersedia</span>
                    <span className="font-extrabold text-on-surface">
                        {selectedTotalQuestions} Soal dari {selectedModuleIds.length} KB
                    </span>
                </div>
            </section>

            <section className="bg-surface-bright border border-surface-variant rounded-[20px] p-4 sm:p-5 shadow-xs">
                <h2 className="text-xs font-bold text-secondary uppercase tracking-wider mb-3">Jumlah soal</h2>
                <div className="grid grid-cols-2 gap-2">
                    {([
                        ['random', `Maks. ${EVENT_RANDOM_COUNT} acak`],
                        ['all', 'Semua soal'],
                    ] as const).map(([value, label]) => (
                        <button key={value} type="button" aria-pressed={selection === value} onClick={() => setSelection(value)}
                            className={`rounded-xl border px-3 py-2.5 text-sm font-bold ${selection === value ? 'border-primary bg-primary/10 text-primary' : 'border-surface-variant text-on-surface'}`}>
                            {label}
                        </button>
                    ))}
                </div>
            </section>

            {/* Mode ujian */}
            <section className="bg-surface-bright border border-surface-variant rounded-[20px] p-4 sm:p-5 shadow-xs flex flex-col gap-3">
                <label className="text-xs font-bold text-secondary uppercase tracking-wider">
                    Mode Ujian
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Opsi 1: Mode Normal */}
                    <button type="button" aria-pressed={chosenMode === 'normal'}
                        onClick={() => setChosenMode('normal')}
                        className={`p-3.5 rounded-2xl border-2 transition-all text-left ${
                            chosenMode === 'normal'
                                ? 'border-primary bg-primary/10 shadow-xs'
                                : 'border-surface-variant bg-surface hover:border-primary/30'
                        }`}
                    >
                        <div className="flex items-center gap-2 mb-1">
                            <BookOpen className="w-4 h-4 text-primary" />
                            <span className="text-sm font-extrabold text-on-surface">Mode Normal</span>
                        </div>
                        <p className="text-xs text-secondary leading-relaxed">
                            Kerjakan soal asli dari bank soal KB terpilih.
                        </p>
                    </button>

                    {/* Opsi 2: Mode Challenge */}
                    <button type="button" aria-pressed={chosenMode === 'challenge'}
                        onClick={() => setChosenMode('challenge')}
                        className={`p-3.5 rounded-2xl border-2 transition-all text-left ${
                            chosenMode === 'challenge'
                                ? 'border-amber-500 bg-amber-500/10 shadow-xs'
                                : 'border-surface-variant bg-surface hover:border-amber-500/30'
                        }`}
                    >
                        <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-amber-500" />
                                <span className="text-sm font-extrabold text-on-surface">Mode Challenge</span>
                            </div>
                            <span className="text-[10px] font-extrabold bg-amber-500 text-white px-2 py-0.5 rounded-full">
                                Langsung Terbuka
                            </span>
                        </div>
                        <p className="text-xs text-secondary leading-relaxed">
                            AI memparafrase pilihan ganda tanpa gambar sebelum ujian.
                        </p>
                    </button>
                </div>
            </section>

            {/* Tombol Eksekusi Mulai Ujian */}
            <div className="pt-2">
                {loadError && <p role="alert" className="mb-2 text-sm text-red-600">{loadError}</p>}
                <button
                    type="button"
                    disabled={examSize === 0 || isLoading}
                    onClick={handleStartEvent}
                    className="w-full bg-primary hover:bg-primary-container disabled:opacity-50 text-on-primary py-3.5 rounded-full font-extrabold text-sm flex items-center justify-center gap-2 shadow-[0_6px_20px_rgba(56,74,216,0.3)] transition-all active:scale-[0.99]"
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>{loadingStep || 'Mempersiapkan Ujian...'}</span>
                        </>
                    ) : (
                        <>
                            <Play className="w-4 h-4 fill-on-primary" />
                            <span>
                                Mulai Simulasi · {examSize} soal
                            </span>
                        </>
                    )}
                </button>
            </div>
        </fieldset>
    );
}
