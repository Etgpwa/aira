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
    AlertCircle,
    Trophy,
    CheckCircle2
} from 'lucide-react';
import Link from 'next/link';
import QuizRunner from '../../[moduleId]/components/QuizRunner';
import { getEventQuestions, batchParaphraseQuestions } from '../../actions';

interface ModuleItem {
    id: string;
    subject_name: string;
    module_title: string;
    kb_title: string;
    best_score: number | null;
    is_completed: boolean;
    course_quiz_questions?: { count: number }[];
}

interface EventQuizClientProps {
    modules: ModuleItem[];
}

export default function EventQuizClient({ modules }: EventQuizClientProps) {
    // Kumpulan unik nama mata kuliah
    const subjects = Array.from(new Set(modules.map((m) => m.subject_name))).filter(Boolean);

    const [selectedSubject, setSelectedSubject] = useState<string>(subjects[0] || '');
    const [selectedModuleIds, setSelectedModuleIds] = useState<string[]>([]);
    const [chosenMode, setChosenMode] = useState<'normal' | 'challenge'>('normal');

    // State saat proses loading & menjalankan ujian
    const [isLoading, setIsLoading] = useState(false);
    const [loadingStep, setLoadingStep] = useState<string>('');
    const [activeExamQuestions, setActiveExamQuestions] = useState<any[] | null>(null);

    // Filter KB berdasarkan matkul yang aktif dipilih
    const subjectModules = modules.filter((m) => m.subject_name === selectedSubject);

    // Hitung total bank soal MCQ yang tersedia dari KB terpilih
    const selectedTotalQuestions = subjectModules
        .filter((m) => selectedModuleIds.includes(m.id))
        .reduce((sum, m) => sum + (m.course_quiz_questions?.[0]?.count ?? 0), 0);

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
        if (selectedModuleIds.length === 0 || selectedTotalQuestions === 0) return;

        setIsLoading(true);
        setLoadingStep('Mengambil soal pilihan ganda acak dari KB terpilih...');

        try {
            const rawQuestions = await getEventQuestions(selectedModuleIds);
            if (!rawQuestions || rawQuestions.length === 0) {
                alert('Tidak ada butir soal pilihan ganda (MCQ) yang ditemukan pada KB-KB yang dipilih.');
                setIsLoading(false);
                return;
            }

            if (chosenMode === 'challenge') {
                setLoadingStep(`Memparafrase ${rawQuestions.length} butir soal dengan Gemini AI...`);
                const paraphrased = await batchParaphraseQuestions(rawQuestions);
                setActiveExamQuestions(paraphrased);
            } else {
                setActiveExamQuestions(rawQuestions);
            }
        } catch (err) {
            console.error('Gagal memulai ujian event:', err);
            alert('Terjadi kesalahan saat memuat soal. Silakan coba lagi.');
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

                    <div className="flex items-center gap-1.5 bg-amber-500/10 text-amber-600 px-2.5 py-1 rounded-full text-xs font-bold shrink-0">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{chosenMode === 'challenge' ? 'Challenge Mode' : 'Normal Mode'}</span>
                    </div>
                </header>

                <main className="w-full max-w-2xl mx-auto px-3.5 sm:px-4 pt-3 pb-8 flex-1">
                    <QuizRunner
                        questions={activeExamQuestions}
                        isEventMode={true}
                        eventName={`Simulasi UTS - ${selectedSubject}`}
                        initialMode={chosenMode}
                    />
                </main>
            </div>
        );
    }

    // ─── Tampilan 2: Form Konfigurasi Simulasi Event ───────────────
    return (
        <div className="min-h-screen bg-surface px-3 sm:px-4 py-4 max-w-3xl mx-auto space-y-6 pb-20">
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
                        Kuis akbar 30 soal acak dari kombinasi beberapa KB pilihanmu
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
                                    setSelectedModuleIds([]);
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
                            Pilih Semua
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
                            const qCount = m.course_quiz_questions?.[0]?.count ?? 0;

                            return (
                                <div
                                    key={m.id}
                                    onClick={() => toggleModule(m.id)}
                                    className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
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
                                            {qCount} Soal MCQ
                                        </span>
                                        {m.is_completed && (
                                            <CheckCircle2 className="w-4 h-4 text-mint-fg shrink-0" />
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Ringkasan Seleksi Soal */}
                <div className="bg-surface-container/60 border border-surface-variant rounded-xl p-3 flex items-center justify-between text-xs">
                    <span className="text-secondary font-medium">Total Soal Terpilih:</span>
                    <span className="font-extrabold text-on-surface">
                        {selectedTotalQuestions} Soal dari {selectedModuleIds.length} KB
                    </span>
                </div>
            </section>

            {/* Langkah 3: Pilih Mode Ujian (Normal vs Challenge) */}
            <section className="bg-surface-bright border border-surface-variant rounded-[20px] p-4 sm:p-5 shadow-xs flex flex-col gap-3">
                <label className="text-xs font-bold text-secondary uppercase tracking-wider">
                    Langkah 3 · Pilih Mode Ujian
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Opsi 1: Mode Normal */}
                    <div
                        onClick={() => setChosenMode('normal')}
                        className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer ${
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
                            Murni soal asli hasil scan bank soal. 30 butir soal diacak langsung dari KB terpilih.
                        </p>
                    </div>

                    {/* Opsi 2: Mode Challenge */}
                    <div
                        onClick={() => setChosenMode('challenge')}
                        className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer ${
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
                            30 butir soal diparafrase serentak oleh AI tepat sebelum ujian dimulai untuk menguji konsep mendalam.
                        </p>
                    </div>
                </div>
            </section>

            {/* Tombol Eksekusi Mulai Ujian */}
            <div className="pt-2">
                <button
                    type="button"
                    disabled={selectedModuleIds.length === 0 || selectedTotalQuestions === 0 || isLoading}
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
                                Mulai Ujian Event (Maks. 30 Soal Acak)
                            </span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
