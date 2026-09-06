'use client';

import { useState, useTransition } from 'react';
import { CheckCircle2, XCircle, Trophy, RotateCcw, Check, ArrowLeft } from 'lucide-react';
import { completeModule } from '../../actions';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface QuizRunnerProps {
    questions: any[];
    moduleId: string;
    isAlreadyCompleted: boolean;
}

export default function QuizRunner({ questions, moduleId, isAlreadyCompleted }: QuizRunnerProps) {
    // Langsung jalankan kuis dengan soal teracak tanpa gate pembuka
    const [simQuestions, setSimQuestions] = useState<any[]>(() => {
        const shuffled = [...questions].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, 10);
    });

    const [currentIndex, setCurrentIndex] = useState(0);
    const [score, setScore] = useState(0);
    const [showResult, setShowResult] = useState(false);
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [isAnswered, setIsAnswered] = useState(false);
    const [answersHistory, setAnswersHistory] = useState<Record<number, { selected: string; isCorrect: boolean }>>({});

    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    const restartQuiz = () => {
        const shuffled = [...questions].sort(() => 0.5 - Math.random());
        setSimQuestions(shuffled.slice(0, 10));
        setCurrentIndex(0);
        setScore(0);
        setShowResult(false);
        setSelectedOption(null);
        setIsAnswered(false);
        setAnswersHistory({});
    };

    const handleAnswer = (optionKey: string) => {
        if (isAnswered) return;

        setSelectedOption(optionKey);
        setIsAnswered(true);

        const currentQ = simQuestions[currentIndex];
        const isCorrect = optionKey === currentQ.correct_answer;
        if (isCorrect) setScore((prev) => prev + 1);

        setAnswersHistory((prev) => ({
            ...prev,
            [currentIndex]: { selected: optionKey, isCorrect }
        }));

        setTimeout(() => {
            if (currentIndex < simQuestions.length - 1) {
                setCurrentIndex((prev) => prev + 1);
                setIsAnswered(false);
                setSelectedOption(null);
            } else {
                setShowResult(true);
            }
        }, 800);
    };

    const handleFinish = () => {
        const finalScore = Math.round((score / simQuestions.length) * 100);
        startTransition(async () => {
            await completeModule(moduleId, finalScore);
            router.push(`/academic/${moduleId}`);
            router.refresh();
        });
    };

    // ─── Tampilan Hasil Kuis ───────────────────────────────────────
    if (showResult) {
        const finalScore = Math.round((score / simQuestions.length) * 100);
        const passed = finalScore >= 70;

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
                    Hasil Simulasi Ujian
                </span>
                <h3 className="text-xl font-extrabold text-on-surface mt-0.5 mb-1">
                    {passed ? 'Luar Biasa, Kamu Lulus!' : 'Masih Perlu Evaluasi'}
                </h3>
                <p className="text-5xl font-black text-primary my-3 tracking-tight">{finalScore}</p>

                <div className="flex justify-center items-center gap-3 text-xs font-semibold mb-6">
                    <span className="px-3 py-1 bg-mint-bg/30 text-mint-fg rounded-full flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Benar: {score}
                    </span>
                    <span className="px-3 py-1 bg-red-50 text-red-600 rounded-full flex items-center gap-1.5">
                        <XCircle className="w-3.5 h-3.5" /> Salah: {simQuestions.length - score}
                    </span>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                    <button
                        onClick={restartQuiz}
                        className="flex-1 bg-surface-container hover:bg-surface-variant text-on-surface py-3 rounded-full font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
                    >
                        <RotateCcw className="w-4 h-4" /> Ulangi Ujian
                    </button>
                    <button
                        onClick={handleFinish}
                        disabled={isPending}
                        className="flex-1 bg-primary hover:bg-primary-container text-on-primary py-3 rounded-full font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] shadow-[0_4px_16px_rgba(56,74,216,0.25)]"
                    >
                        {isPending ? (
                            <span>Menyimpan Nilai...</span>
                        ) : (
                            <>
                                <Check className="w-4 h-4" /> Simpan Nilai & Selesai
                            </>
                        )}
                    </button>
                </div>
            </div>
        );
    }

    // ─── Tampilan Ujian CBT Aktif ───────────────────────────────────
    const currentQ = simQuestions[currentIndex];
    if (!currentQ) return null;

    const progressPct = ((currentIndex + 1) / simQuestions.length) * 100;

    const getOptionClass = (optKey: string) => {
        const base =
            'flex items-center gap-3 p-3 sm:p-3.5 border rounded-xl text-xs sm:text-sm transition-all text-left w-full cursor-pointer active:scale-[0.99]';
        if (!isAnswered) {
            return `${base} ${
                selectedOption === optKey
                    ? 'border-primary bg-primary/10 text-primary font-bold'
                    : 'border-surface-variant bg-surface hover:border-primary/40 text-on-surface'
            }`;
        }
        if (optKey === currentQ.correct_answer) {
            return `${base} border-mint-fg bg-mint-bg/30 text-mint-fg font-bold`;
        }
        if (selectedOption === optKey) {
            return `${base} border-red-500 bg-red-50 text-red-600 font-bold`;
        }
        return `${base} border-surface-variant text-secondary opacity-40`;
    };

    const getBadgeClass = (optKey: string) => {
        const baseBadge = 'w-7 h-7 rounded-lg font-black text-xs flex items-center justify-center shrink-0 transition-colors';
        if (!isAnswered) {
            return selectedOption === optKey
                ? `${baseBadge} bg-primary text-on-primary`
                : `${baseBadge} bg-surface-container text-secondary`;
        }
        if (optKey === currentQ.correct_answer) {
            return `${baseBadge} bg-mint-fg text-white`;
        }
        if (selectedOption === optKey) {
            return `${baseBadge} bg-red-600 text-white`;
        }
        return `${baseBadge} bg-surface-container text-secondary opacity-50`;
    };

    return (
        <div className="flex flex-col gap-3">
            {/* CBT Top Bar: Status No Soal & Strip Navigasi Butir Soal */}
            <div className="flex justify-between items-center px-1">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold text-primary bg-primary/10 px-2.5 py-1 rounded-md tracking-wider">
                        SOAL #{currentIndex + 1}
                    </span>
                    <span className="text-xs text-secondary font-semibold">
                        dari {simQuestions.length} Soal
                    </span>
                </div>
                <span className="text-xs font-bold text-secondary">
                    {Math.round(progressPct)}%
                </span>
            </div>

            {/* Strip Nomor Soal CBT */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {simQuestions.map((_, idx) => {
                    const history = answersHistory[idx];
                    const isCurrent = idx === currentIndex;
                    return (
                        <div
                            key={idx}
                            className={`w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 transition-all ${
                                isCurrent
                                    ? 'bg-primary text-on-primary ring-2 ring-primary/30 shadow-xs scale-105'
                                    : history
                                    ? history.isCorrect
                                        ? 'bg-mint-bg/40 text-mint-fg'
                                        : 'bg-red-50 text-red-600'
                                    : 'bg-surface-container text-secondary'
                            }`}
                        >
                            {idx + 1}
                        </div>
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

                <div className="flex flex-col gap-2">
                    {(['A', 'B', 'C', 'D'] as const).map((optKey) => {
                        const optText = currentQ[`option_${optKey.toLowerCase()}`];
                        if (!optText) return null;
                        return (
                            <button
                                key={optKey}
                                type="button"
                                disabled={isAnswered}
                                onClick={() => handleAnswer(optKey)}
                                className={getOptionClass(optKey)}
                            >
                                <div className={getBadgeClass(optKey)}>
                                    {optKey}
                                </div>
                                <span className="flex-1 leading-snug">{optText}</span>
                                {isAnswered && optKey === currentQ.correct_answer && (
                                    <CheckCircle2 className="w-4 h-4 text-mint-fg shrink-0" />
                                )}
                                {isAnswered && selectedOption === optKey && optKey !== currentQ.correct_answer && (
                                    <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
