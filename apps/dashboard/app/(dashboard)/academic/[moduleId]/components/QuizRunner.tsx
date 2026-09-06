'use client';

import { useState, useTransition } from 'react';
import {
    CheckCircle2,
    XCircle,
    Trophy,
    RotateCcw,
    Check,
    ArrowLeft,
    ArrowRight,
    Sparkles,
    Lock,
    BookOpen,
    FileEdit,
    Loader2,
    HelpCircle,
    AlertCircle,
    ChevronLeft,
    ChevronRight,
    Save
} from 'lucide-react';
import { completeModule, batchParaphraseQuestions, saveQuestionNote } from '../../actions';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface QuizRunnerProps {
    questions: any[];
    moduleId?: string;
    isAlreadyCompleted?: boolean;
    bestScore?: number | null;
    initialMode?: 'normal' | 'challenge';
    isEventMode?: boolean;
    eventName?: string;
}

export default function QuizRunner({
    questions,
    moduleId,
    isAlreadyCompleted = false,
    bestScore = 0,
    initialMode = 'normal',
    isEventMode = false,
    eventName = 'Simulasi Kuis'
}: QuizRunnerProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    // Challenge Unlock Rule: Di Mode Event langsung terbuka, di Mode KB reguler harus nilai 100
    const isChallengeUnlocked = isEventMode || (bestScore ?? 0) >= 100;

    // Mode Kuis: Normal vs Challenge
    const [currentMode, setCurrentMode] = useState<'normal' | 'challenge'>(
        initialMode === 'challenge' && isChallengeUnlocked ? 'challenge' : 'normal'
    );

    // Kumpulan Soal Aktif
    const maxCount = isEventMode ? 30 : 10;
    const [simQuestions, setSimQuestions] = useState<any[]>(() => {
        const shuffled = [...questions].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, maxCount);
    });

    const [isParaphrasing, setIsParaphrasing] = useState(false);
    const [hasParaphrased, setHasParaphrased] = useState(false);

    // CBT Navigation & Answer State
    const [currentIndex, setCurrentIndex] = useState(0);
    const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
    const [showResult, setShowResult] = useState(false);
    const [isReviewMode, setIsReviewMode] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);

    // Catatan Belajar (User Notes) di Review Mode
    const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});
    const [noteSavingId, setNoteSavingId] = useState<string | null>(null);
    const [noteSuccessMsg, setNoteSuccessMsg] = useState<string | null>(null);

    // ─── Reset / Ulangi Ujian ──────────────────────────────────────
    const restartQuiz = () => {
        const shuffled = [...questions].sort(() => 0.5 - Math.random());
        setSimQuestions(shuffled.slice(0, maxCount));
        setCurrentIndex(0);
        setUserAnswers({});
        setShowResult(false);
        setIsReviewMode(false);
        setShowConfirmModal(false);
        setNoteSuccessMsg(null);
    };

    // ─── Pergantian Mode Kuis ──────────────────────────────────────
    const handleSwitchMode = async (targetMode: 'normal' | 'challenge') => {
        if (targetMode === currentMode) return;

        if (targetMode === 'challenge') {
            if (!isChallengeUnlocked) return;
            setCurrentMode('challenge');
            // Jika belum diparafrase, trigger batch paraphrase sekarang
            if (!hasParaphrased) {
                await generateChallengeQuestions(simQuestions);
            }
        } else {
            setCurrentMode('normal');
            // Reset ke soal original acak
            const shuffled = [...questions].sort(() => 0.5 - Math.random());
            setSimQuestions(shuffled.slice(0, maxCount));
            setCurrentIndex(0);
            setUserAnswers({});
            setShowResult(false);
            setIsReviewMode(false);
        }
    };

    const generateChallengeQuestions = async (basePool: any[]) => {
        setIsParaphrasing(true);
        try {
            const paraphrased = await batchParaphraseQuestions(basePool);
            setSimQuestions(paraphrased);
            setHasParaphrased(true);
            setCurrentIndex(0);
            setUserAnswers({});
            setShowResult(false);
            setIsReviewMode(false);
        } catch (err) {
            console.error('Gagal generate challenge questions:', err);
        } finally {
            setIsParaphrasing(false);
        }
    };

    // ─── Interaksi Jawaban (Pilih Opsi tanpa Reveal Jawaban) ───────
    const handleSelectOption = (optionKey: string) => {
        if (showResult || isReviewMode) return;
        setUserAnswers((prev) => ({
            ...prev,
            [currentIndex]: optionKey
        }));
    };

    // ─── Navigasi Soal ─────────────────────────────────────────────
    const goToQuestion = (idx: number) => {
        if (idx >= 0 && idx < simQuestions.length) {
            setCurrentIndex(idx);
            setNoteSuccessMsg(null);
        }
    };

    const handleNext = () => {
        if (currentIndex < simQuestions.length - 1) {
            setCurrentIndex((prev) => prev + 1);
            setNoteSuccessMsg(null);
        }
    };

    const handlePrev = () => {
        if (currentIndex > 0) {
            setCurrentIndex((prev) => prev - 1);
            setNoteSuccessMsg(null);
        }
    };

    // ─── Hitung Skor & Selesaikan Ujian ───────────────────────────
    const unansweredCount = simQuestions.length - Object.keys(userAnswers).length;

    const handleFinishExam = () => {
        setShowConfirmModal(false);
        setShowResult(true);
        setIsReviewMode(false);
    };

    const calculateScore = () => {
        let correct = 0;
        simQuestions.forEach((q, idx) => {
            if (userAnswers[idx] === q.correct_answer) {
                correct++;
            }
        });
        const finalScore = Math.round((correct / simQuestions.length) * 100);
        return { correct, finalScore };
    };

    // ─── 3 Tombol Utama di Layar Hasil ────────────────────────────
    // 1. Tombol Lanjut: Simpan nilai & kembali
    const handleLanjut = () => {
        const { finalScore } = calculateScore();
        if (moduleId && !isEventMode) {
            startTransition(async () => {
                await completeModule(moduleId, finalScore);
                router.push(`/academic/${moduleId}`);
                router.refresh();
            });
        } else {
            router.push('/academic');
            router.refresh();
        }
    };

    // 2. Tombol Ulangi: restartQuiz() sudah didefinisikan di atas

    // 3. Tombol Review: Buka pembahasan
    const handleOpenReview = () => {
        setIsReviewMode(true);
        setCurrentIndex(0);
        setNoteSuccessMsg(null);
    };

    // ─── Simpan Catatan Belajar ke Database ───────────────────────
    const handleSaveNote = async (questionId: string) => {
        const noteText = noteInputs[questionId] !== undefined
            ? noteInputs[questionId]
            : (simQuestions[currentIndex]?.user_note || '');

        setNoteSavingId(questionId);
        try {
            await saveQuestionNote(questionId, noteText);
            // Update local state agar sinkron
            setSimQuestions((prev) =>
                prev.map((q) => (q.id === questionId ? { ...q, user_note: noteText } : q))
            );
            setNoteSuccessMsg('Catatan berhasil disimpan ke database!');
            setTimeout(() => setNoteSuccessMsg(null), 3000);
        } catch (err) {
            console.error('Gagal menyimpan catatan:', err);
            setNoteSuccessMsg('Gagal menyimpan catatan. Coba lagi.');
        } finally {
            setNoteSavingId(null);
        }
    };

    // ─── Loading State saat Paraphrasing AI ───────────────────────
    if (isParaphrasing) {
        return (
            <div className="bg-surface-bright border border-surface-variant rounded-[24px] p-8 text-center flex flex-col items-center justify-center gap-4 min-h-[350px] shadow-sm">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center animate-pulse">
                    <Sparkles className="w-8 h-8 animate-spin" />
                </div>
                <div>
                    <h3 className="text-base font-extrabold text-on-surface">Menyiapkan Mode Challenge</h3>
                    <p className="text-xs text-secondary mt-1 max-w-sm leading-relaxed">
                        Gemini AI sedang memparafrase {simQuestions.length} butir soal secara serentak. Kalimat dirombak agar menguji pemahaman konsep secara mendalam.
                    </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-primary font-bold bg-primary/10 px-3 py-1.5 rounded-full">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Memproses dengan AI...</span>
                </div>
            </div>
        );
    }

    const { correct, finalScore } = calculateScore();
    const passed = finalScore >= 70;
    const currentQ = simQuestions[currentIndex];

    // ─── Tampilan 1: Layar Skor Hasil Ujian (3 Tombol) ─────────────
    if (showResult && !isReviewMode) {
        return (
            <div className="bg-surface border border-surface-variant rounded-2xl p-5 sm:p-7 text-center shadow-xs">
                <div
                    className={`w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center ${
                        passed ? 'bg-mint-bg/30 text-mint-fg' : 'bg-peach-bg/30 text-peach-fg'
                    }`}
                >
                    <Trophy className="w-8 h-8" />
                </div>
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-secondary">
                    {isEventMode ? 'Hasil Simulasi Event' : `Hasil Simulasi Kuis (${currentMode.toUpperCase()})`}
                </span>
                <h3 className="text-xl font-extrabold text-on-surface mt-0.5 mb-1">
                    {passed ? 'Luar Biasa, Kamu Lulus!' : 'Masih Perlu Evaluasi'}
                </h3>
                <p className="text-5xl font-black text-primary my-3 tracking-tight">{finalScore}</p>

                <div className="flex justify-center items-center gap-3 text-xs font-semibold mb-6">
                    <span className="px-3 py-1 bg-mint-bg/30 text-mint-fg rounded-full flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Benar: {correct}
                    </span>
                    <span className="px-3 py-1 bg-red-50 text-red-600 rounded-full flex items-center gap-1.5">
                        <XCircle className="w-3.5 h-3.5" /> Salah: {simQuestions.length - correct}
                    </span>
                    {unansweredCount > 0 && (
                        <span className="px-3 py-1 bg-surface-container text-secondary rounded-full">
                            Kosong: {unansweredCount}
                        </span>
                    )}
                </div>

                {/* Info Unlock Challenge jika KB reguler dan skor 100 */}
                {!isEventMode && finalScore === 100 && currentMode === 'normal' && (
                    <div className="mb-6 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium flex items-center justify-center gap-2">
                        <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Selamat! Nilai sempurna 100. <strong>Mode Challenge</strong> materi ini telah terbuka!</span>
                    </div>
                )}

                {/* 3 Tombol Utama: Lanjut, Ulangi, Review */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {/* Tombol 1: Ulangi */}
                    <button
                        onClick={restartQuiz}
                        className="bg-surface-container hover:bg-surface-variant text-on-surface py-3 rounded-full font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
                    >
                        <RotateCcw className="w-4 h-4" /> Ulangi Ujian
                    </button>

                    {/* Tombol 2: Review Pembahasan */}
                    <button
                        onClick={handleOpenReview}
                        className="bg-surface-bright hover:bg-surface-variant border-2 border-primary/30 text-primary py-3 rounded-full font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
                    >
                        <BookOpen className="w-4 h-4" /> Review Jawaban
                    </button>

                    {/* Tombol 3: Lanjut (Simpan & Selesai) */}
                    <button
                        onClick={handleLanjut}
                        disabled={isPending}
                        className="bg-primary hover:bg-primary-container text-on-primary py-3 rounded-full font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] shadow-[0_4px_16px_rgba(56,74,216,0.25)]"
                    >
                        {isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <>
                                <Check className="w-4 h-4" /> Selesai & Lanjut
                            </>
                        )}
                    </button>
                </div>
            </div>
        );
    }

    // ─── Tampilan 2: Mode Review Pembahasan & Catatan ──────────────
    if (isReviewMode) {
        if (!currentQ) return null;
        const userAnswer = userAnswers[currentIndex];
        const isCorrect = userAnswer === currentQ.correct_answer;
        const currentNote = noteInputs[currentQ.id] !== undefined
            ? noteInputs[currentQ.id]
            : (currentQ.user_note || '');

        return (
            <div className="flex flex-col gap-3">
                {/* Header Review */}
                <div className="flex items-center justify-between bg-surface-bright border border-surface-variant rounded-xl px-3.5 py-2.5">
                    <button
                        onClick={() => setIsReviewMode(false)}
                        className="flex items-center gap-1.5 text-xs font-bold text-secondary hover:text-on-surface"
                    >
                        <ArrowLeft className="w-4 h-4" /> Kembali ke Skor
                    </button>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                            PEMBAHASAN SOAL #{currentIndex + 1}
                        </span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            !userAnswer ? 'bg-surface-container text-secondary' : isCorrect ? 'bg-mint-bg/40 text-mint-fg' : 'bg-red-50 text-red-600'
                        }`}>
                            {!userAnswer ? 'Kosong' : isCorrect ? 'Benar' : 'Salah'}
                        </span>
                    </div>
                </div>

                {/* Strip Navigasi Butir Soal Review (Hijau/Merah) */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                    {simQuestions.map((q, idx) => {
                        const ans = userAnswers[idx];
                        const qCorrect = ans === q.correct_answer;
                        const isCurrent = idx === currentIndex;

                        let colorClass = 'bg-surface-container text-secondary';
                        if (ans) {
                            colorClass = qCorrect
                                ? 'bg-mint-bg/50 text-mint-fg border border-mint-fg/30'
                                : 'bg-red-50 text-red-600 border border-red-200';
                        }

                        return (
                            <button
                                key={idx}
                                onClick={() => goToQuestion(idx)}
                                className={`w-8 h-8 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 transition-all ${colorClass} ${
                                    isCurrent ? 'ring-2 ring-primary shadow-sm scale-105' : 'hover:opacity-80'
                                }`}
                            >
                                {idx + 1}
                            </button>
                        );
                    })}
                </div>

                {/* Kartu Soal Review */}
                <div className="bg-surface border border-surface-variant rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col gap-4">
                    <p className="text-sm sm:text-base font-semibold text-on-surface leading-relaxed whitespace-pre-line">
                        {currentQ.question_text}
                    </p>

                    <div className="flex flex-col gap-2">
                        {(['A', 'B', 'C', 'D'] as const).map((optKey) => {
                            const optText = currentQ[`option_${optKey.toLowerCase()}`];
                            if (!optText) return null;

                            const isKunci = optKey === currentQ.correct_answer;
                            const isUserChoice = optKey === userAnswer;

                            let optClass = 'flex items-center gap-3 p-3 sm:p-3.5 border rounded-xl text-xs sm:text-sm text-left w-full transition-all';
                            let badgeClass = 'w-7 h-7 rounded-lg font-black text-xs flex items-center justify-center shrink-0';

                            if (isKunci) {
                                optClass += ' border-mint-fg bg-mint-bg/30 text-mint-fg font-bold';
                                badgeClass += ' bg-mint-fg text-white';
                            } else if (isUserChoice && !isCorrect) {
                                optClass += ' border-red-500 bg-red-50 text-red-600 font-bold';
                                badgeClass += ' bg-red-600 text-white';
                            } else {
                                optClass += ' border-surface-variant text-secondary opacity-60';
                                badgeClass += ' bg-surface-container text-secondary';
                            }

                            return (
                                <div key={optKey} className={optClass}>
                                    <div className={badgeClass}>{optKey}</div>
                                    <span className="flex-1 leading-snug">{optText}</span>
                                    {isKunci && (
                                        <span className="text-[10px] bg-mint-fg text-white font-extrabold px-2 py-0.5 rounded-full shrink-0">
                                            Kunci Benar
                                        </span>
                                    )}
                                    {isUserChoice && !isKunci && (
                                        <span className="text-[10px] bg-red-600 text-white font-extrabold px-2 py-0.5 rounded-full shrink-0">
                                            Pilihanmu (Keliru)
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Fitur Catatan / Komentar Pengerjaan (Tersimpan ke Database) */}
                    <div className="mt-2 pt-3 border-t border-surface-variant flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                                <FileEdit className="w-4 h-4 text-primary" /> Catatan / Trik Pengerjaan Pribadi:
                            </label>
                            {noteSuccessMsg && (
                                <span className="text-[11px] text-mint-fg font-bold animate-in fade-in">
                                    {noteSuccessMsg}
                                </span>
                            )}
                        </div>
                        <p className="text-[11px] text-secondary">
                            Tuliskan rumus, cara pengerjaan, atau tips soal ini. Catatan ini tersimpan permanen di database dan otomatis muncul saat soal ini di-review lagi.
                        </p>
                        <textarea
                            rows={2}
                            value={currentNote}
                            onChange={(e) =>
                                setNoteInputs((prev) => ({
                                    ...prev,
                                    [currentQ.id]: e.target.value
                                }))
                            }
                            placeholder="Contoh: Cara ngerjainnya eliminasi opsi A & B, lalu pakai rumus X..."
                            className="w-full bg-surface-container border border-surface-variant rounded-xl p-3 text-xs text-on-surface focus:outline-none focus:border-primary resize-none"
                        />
                        <div className="flex justify-end">
                            <button
                                type="button"
                                disabled={noteSavingId === currentQ.id}
                                onClick={() => handleSaveNote(currentQ.id)}
                                className="bg-primary hover:bg-primary-container text-on-primary px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
                            >
                                {noteSavingId === currentQ.id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    <Save className="w-3.5 h-3.5" />
                                )}
                                <span>Simpan Catatan</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Tombol Navigasi Review */}
                <div className="flex items-center justify-between gap-3 pt-1">
                    <button
                        onClick={handlePrev}
                        disabled={currentIndex === 0}
                        className="flex-1 bg-surface-bright border border-surface-variant disabled:opacity-40 text-on-surface py-2.5 rounded-full font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                    >
                        <ChevronLeft className="w-4 h-4" /> Soal Sebelumnya
                    </button>
                    <button
                        onClick={handleNext}
                        disabled={currentIndex === simQuestions.length - 1}
                        className="flex-1 bg-surface-bright border border-surface-variant disabled:opacity-40 text-on-surface py-2.5 rounded-full font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                    >
                        Soal Berikutnya <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        );
    }

    // ─── Tampilan 3: Ujian CBT Realistis Sedang Berjalan ───────────
    if (!currentQ) return null;

    const progressPct = ((currentIndex + 1) / simQuestions.length) * 100;
    const isAnsweredCurrent = userAnswers[currentIndex] !== undefined;

    return (
        <div className="flex flex-col gap-3">
            {/* Mode Switcher Bar (Normal vs Challenge) */}
            <div className="flex items-center justify-between bg-surface-bright border border-surface-variant rounded-2xl p-1.5 shadow-xs">
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => handleSwitchMode('normal')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            currentMode === 'normal'
                                ? 'bg-primary text-on-primary shadow-xs'
                                : 'text-secondary hover:text-on-surface'
                        }`}
                    >
                        Mode Normal
                    </button>
                    <button
                        onClick={() => handleSwitchMode('challenge')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                            currentMode === 'challenge'
                                ? 'bg-amber-500 text-white shadow-xs'
                                : isChallengeUnlocked
                                ? 'text-secondary hover:text-on-surface'
                                : 'text-secondary/50 cursor-not-allowed'
                        }`}
                        title={
                            isChallengeUnlocked
                                ? 'Soal diparafrase serentak oleh AI'
                                : 'Raih nilai 100 di Mode Normal untuk membuka Challenge Mode'
                        }
                    >
                        {!isChallengeUnlocked && <Lock className="w-3 h-3 text-secondary/60" />}
                        {isChallengeUnlocked && <Sparkles className="w-3 h-3 text-amber-500" />}
                        <span>Mode Challenge</span>
                    </button>
                </div>

                <div className="text-[11px] font-bold text-secondary px-2">
                    Terjawab: {Object.keys(userAnswers).length}/{simQuestions.length}
                </div>
            </div>

            {/* Banner Mode Challenge Aktif */}
            {currentMode === 'challenge' && (
                <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-3 py-2 text-xs flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>
                            <strong>Challenge Mode Aktif:</strong> Soal diparafrase oleh AI untuk menguji pemahaman konsep.
                        </span>
                    </div>
                </div>
            )}

            {/* Top Bar: Nomor Soal Aktif & Persentase */}
            <div className="flex justify-between items-center px-1">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold text-primary bg-primary/10 px-2.5 py-1 rounded-md tracking-wider">
                        SOAL #{currentIndex + 1}
                    </span>
                    <span className="text-xs text-secondary font-semibold">
                        dari {simQuestions.length} Soal
                    </span>
                </div>
                <span className="text-xs font-bold text-secondary">{Math.round(progressPct)}%</span>
            </div>

            {/* Strip Nomor Soal Interaktif (Klik Bebas layaknya Ujian CBT) */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {simQuestions.map((_, idx) => {
                    const isCurrent = idx === currentIndex;
                    const isAnswered = userAnswers[idx] !== undefined;

                    let btnClass = 'bg-surface-container text-secondary';
                    if (isCurrent) {
                        btnClass = 'bg-primary text-on-primary ring-2 ring-primary/40 shadow-xs scale-105 font-black';
                    } else if (isAnswered) {
                        btnClass = 'bg-primary/20 text-primary border border-primary/40 font-bold';
                    }

                    return (
                        <button
                            key={idx}
                            type="button"
                            onClick={() => goToQuestion(idx)}
                            className={`w-8 h-8 rounded-lg text-xs flex items-center justify-center shrink-0 transition-all ${btnClass}`}
                            title={`Lompat ke Soal #${idx + 1}`}
                        >
                            {idx + 1}
                        </button>
                    );
                })}
            </div>

            {/* Progress Bar Tipis */}
            <div className="w-full bg-surface-variant rounded-full h-1 overflow-hidden">
                <div
                    className="bg-primary h-full transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                />
            </div>

            {/* Kartu Soal & Pilihan Jawaban */}
            <div className="bg-surface border border-surface-variant rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col gap-4">
                <p className="text-sm sm:text-base font-semibold text-on-surface leading-relaxed whitespace-pre-line">
                    {currentQ.question_text}
                </p>

                {/* Daftar Pilihan Opsi A, B, C, D */}
                <div className="flex flex-col gap-2">
                    {(['A', 'B', 'C', 'D'] as const).map((optKey) => {
                        const optText = currentQ[`option_${optKey.toLowerCase()}`];
                        if (!optText) return null;

                        const isSelected = userAnswers[currentIndex] === optKey;

                        return (
                            <button
                                key={optKey}
                                type="button"
                                onClick={() => handleSelectOption(optKey)}
                                className={`flex items-center gap-3 p-3 sm:p-3.5 border rounded-xl text-xs sm:text-sm transition-all text-left w-full cursor-pointer active:scale-[0.99] ${
                                    isSelected
                                        ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs'
                                        : 'border-surface-variant bg-surface hover:border-primary/40 text-on-surface'
                                }`}
                            >
                                <div
                                    className={`w-7 h-7 rounded-lg font-black text-xs flex items-center justify-center shrink-0 transition-colors ${
                                        isSelected
                                            ? 'bg-primary text-on-primary'
                                            : 'bg-surface-container text-secondary'
                                    }`}
                                >
                                    {optKey}
                                </div>
                                <span className="flex-1 leading-snug">{optText}</span>
                                {isSelected && (
                                    <Check className="w-4 h-4 text-primary shrink-0 font-bold" />
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Tombol Navigasi Bawah: Sebelumnya & Selanjutnya / Kumpulkan */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-surface-variant">
                    <button
                        type="button"
                        onClick={handlePrev}
                        disabled={currentIndex === 0}
                        className="bg-surface-bright border border-surface-variant disabled:opacity-40 text-on-surface px-4 py-2.5 rounded-full font-bold text-xs flex items-center gap-1.5 transition-all"
                    >
                        <ChevronLeft className="w-4 h-4" /> Sebelumnya
                    </button>

                    <div className="flex items-center gap-2">
                        {currentIndex < simQuestions.length - 1 ? (
                            <button
                                type="button"
                                onClick={handleNext}
                                className="bg-primary hover:bg-primary-container text-on-primary px-5 py-2.5 rounded-full font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 shadow-xs"
                            >
                                Selanjutnya <ChevronRight className="w-4 h-4" />
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={() => {
                                    if (unansweredCount > 0) {
                                        setShowConfirmModal(true);
                                    } else {
                                        handleFinishExam();
                                    }
                                }}
                                className="bg-mint-fg hover:bg-mint-fg/90 text-white px-5 py-2.5 rounded-full font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 shadow-xs"
                            >
                                <Check className="w-4 h-4" /> Selesai Ujian
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Quick Submit Floating Button jika sudah mengerjakan sebagian besar soal */}
            {currentIndex < simQuestions.length - 1 && (
                <div className="flex justify-end px-1">
                    <button
                        type="button"
                        onClick={() => {
                            if (unansweredCount > 0) {
                                setShowConfirmModal(true);
                            } else {
                                handleFinishExam();
                            }
                        }}
                        className="text-xs text-secondary hover:text-on-surface font-semibold underline underline-offset-4"
                    >
                        Kumpulkan & Selesaikan Ujian Sekarang
                    </button>
                </div>
            )}

            {/* Modal Konfirmasi Selesai jika ada soal belum terjawab */}
            {showConfirmModal && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-surface-bright border border-surface-variant rounded-[24px] p-5 w-full max-w-sm shadow-2xl flex flex-col gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                                <AlertCircle className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-on-surface">Masih Ada Soal Kosong</h3>
                                <p className="text-xs text-secondary mt-0.5">
                                    Terdapat <strong>{unansweredCount} butir soal</strong> yang belum dijawab.
                                </p>
                            </div>
                        </div>

                        <p className="text-xs text-secondary leading-relaxed">
                            Apakah kamu yakin ingin menyelesaikan ujian sekarang? Soal yang kosong akan dihitung sebagai jawaban salah.
                        </p>

                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setShowConfirmModal(false)}
                                className="flex-1 bg-surface-container hover:bg-surface-variant text-on-surface py-2.5 rounded-full font-bold text-xs transition-all"
                            >
                                Lanjut Mengerjakan
                            </button>
                            <button
                                type="button"
                                onClick={handleFinishExam}
                                className="flex-1 bg-primary hover:bg-primary-container text-on-primary py-2.5 rounded-full font-bold text-xs transition-all shadow-xs"
                            >
                                Tetap Kumpulkan
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
