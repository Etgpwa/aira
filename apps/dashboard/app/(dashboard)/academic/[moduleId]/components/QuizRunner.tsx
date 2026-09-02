'use client';

import { useState, useTransition } from 'react';
import { Play, CheckCircle, XCircle, Trophy, RotateCcw } from 'lucide-react';
import { completeModule } from '../../actions';
import { useRouter } from 'next/navigation';

interface QuizRunnerProps {
    questions: any[];
    moduleId: string;
    isAlreadyCompleted: boolean;
}

export default function QuizRunner({ questions, moduleId, isAlreadyCompleted }: QuizRunnerProps) {
    const [isRunning, setIsRunning] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [score, setScore] = useState(0);
    const [showResult, setShowResult] = useState(false);
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [isAnswered, setIsAnswered] = useState(false);
    const [simQuestions, setSimQuestions] = useState<any[]>([]);
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    const startQuiz = () => {
        // Ambil semua soal MCQ, shuffle, max 10
        const shuffled = [...questions].sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, 10);
        setSimQuestions(selected);
        setCurrentIndex(0);
        setScore(0);
        setShowResult(false);
        setIsRunning(true);
        setSelectedOption(null);
        setIsAnswered(false);
    };

    const handleAnswer = (optionKey: string) => {
        if (isAnswered) return;

        setSelectedOption(optionKey);
        setIsAnswered(true);

        const currentQ = simQuestions[currentIndex];
        const isCorrect = optionKey === currentQ.correct_answer;
        if (isCorrect) setScore(prev => prev + 1);

        setTimeout(() => {
            if (currentIndex < simQuestions.length - 1) {
                setCurrentIndex(prev => prev + 1);
                setIsAnswered(false);
                setSelectedOption(null);
            } else {
                setShowResult(true);
            }
        }, 1200);
    };

    const handleFinish = () => {
        const finalScore = Math.round((score / simQuestions.length) * 100);
        startTransition(async () => {
            await completeModule(moduleId, finalScore);
            setIsRunning(false);
            setShowResult(false);
            router.refresh();
        });
    };

    // ─── Idle State ───────────────────────────────────────────────
    if (!isRunning) {
        return (
            <div className="bg-surface-bright border border-surface-variant rounded-[20px] p-5">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-11 h-11 rounded-[14px] bg-primary/10 flex items-center justify-center">
                        <Play className="w-5 h-5 text-primary fill-primary" />
                    </div>
                    <div>
                        <p className="font-bold text-on-surface">Simulasi Kuis</p>
                        <p className="text-xs text-secondary">Maks. 10 soal acak dari {questions.length} soal MCQ</p>
                    </div>
                </div>
                {isAlreadyCompleted && (
                    <p className="text-xs text-secondary mb-3 flex items-center gap-1.5">
                        <RotateCcw className="w-3.5 h-3.5" /> Kerjakan ulang untuk meningkatkan skor
                    </p>
                )}
                <button
                    onClick={startQuiz}
                    className="w-full bg-primary text-on-primary py-3 rounded-full font-bold active:scale-[0.98] transition-transform"
                >
                    {isAlreadyCompleted ? 'Ulangi Kuis' : 'Mulai Kuis'}
                </button>
            </div>
        );
    }

    // ─── Result State ─────────────────────────────────────────────
    if (showResult) {
        const finalScore = Math.round((score / simQuestions.length) * 100);
        const passed = finalScore >= 70;

        return (
            <div className="bg-surface-bright border border-surface-variant rounded-[20px] p-6 text-center">
                <div className={`w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center ${passed ? 'bg-mint-bg' : 'bg-peach-bg'}`}>
                    <Trophy className={`w-9 h-9 ${passed ? 'text-mint-fg' : 'text-peach-fg'}`} />
                </div>
                <h3 className="text-xl font-extrabold text-on-surface mb-1">
                    {passed ? 'Kerja Bagus!' : 'Masih Bisa Lebih Baik!'}
                </h3>
                <p className="text-5xl font-extrabold text-primary my-4">{finalScore}</p>
                <p className="text-sm text-secondary mb-6">Benar {score} dari {simQuestions.length} soal</p>

                <div className="flex gap-3">
                    <button
                        onClick={() => { setIsRunning(false); setShowResult(false); }}
                        className="flex-1 bg-surface-container text-secondary py-3 rounded-full font-bold text-sm"
                    >
                        Tutup
                    </button>
                    <button
                        onClick={handleFinish}
                        disabled={isPending}
                        className="flex-1 bg-primary text-on-primary py-3 rounded-full font-bold text-sm flex items-center justify-center gap-1.5"
                    >
                        <CheckCircle className="w-4 h-4" />
                        {isPending ? 'Menyimpan...' : 'Selesai & Simpan'}
                    </button>
                </div>
            </div>
        );
    }

    // ─── Quiz Running State ───────────────────────────────────────
    const currentQ = simQuestions[currentIndex];
    const progressPct = ((currentIndex) / simQuestions.length) * 100;

    const getOptionClass = (optKey: string) => {
        const base = 'flex items-center justify-between p-3.5 border-2 rounded-[14px] text-sm transition-all text-left w-full';
        if (!isAnswered) {
            return `${base} ${selectedOption === optKey ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-surface-variant bg-surface-bright hover:border-primary/30'}`;
        }
        if (optKey === currentQ.correct_answer) return `${base} border-mint-fg bg-mint-bg/30 text-mint-fg font-bold`;
        if (selectedOption === optKey) return `${base} border-red-400 bg-red-50 text-red-600`;
        return `${base} border-surface-variant opacity-40`;
    };

    return (
        <div className="bg-surface-bright border border-surface-variant rounded-[20px] overflow-hidden">
            {/* Progress Bar */}
            <div className="h-1.5 bg-surface-variant">
                <div className="h-full bg-primary transition-all duration-500" style={{ width: `${progressPct}%` }} />
            </div>

            <div className="p-5">
                <div className="flex justify-between items-center mb-4">
                    <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                        {currentQ.subject_name}
                    </span>
                    <span className="text-sm font-bold text-secondary">
                        {currentIndex + 1} / {simQuestions.length}
                    </span>
                </div>

                <p className="text-base font-bold text-on-surface mb-5 leading-snug">{currentQ.question_text}</p>

                <div className="flex flex-col gap-2.5">
                    {(['A', 'B', 'C', 'D'] as const).map(optKey => {
                        const optText = currentQ[`option_${optKey.toLowerCase()}`];
                        if (!optText) return null;
                        return (
                            <button
                                key={optKey}
                                disabled={isAnswered}
                                onClick={() => handleAnswer(optKey)}
                                className={getOptionClass(optKey)}
                            >
                                <span>
                                    <span className="font-bold mr-2">{optKey}.</span>
                                    {optText}
                                </span>
                                {isAnswered && optKey === currentQ.correct_answer && <CheckCircle className="w-4 h-4 text-mint-fg flex-shrink-0" />}
                                {isAnswered && selectedOption === optKey && optKey !== currentQ.correct_answer && <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
