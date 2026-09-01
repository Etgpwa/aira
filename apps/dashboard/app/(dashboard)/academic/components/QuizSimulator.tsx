'use client';

import { useState } from 'react';
import { Play, CheckCircle, XCircle } from 'lucide-react';

export default function QuizSimulator({ questions }: { questions: any[] }) {
    const [isSimulating, setIsSimulating] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [score, setScore] = useState(0);
    const [showResult, setShowResult] = useState(false);
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [isAnswered, setIsAnswered] = useState(false);

    // Ambil maksimal 10 soal acak dari bank soal
    const [simQuestions, setSimQuestions] = useState<any[]>([]);

    const startSimulation = () => {
        // Ambil soal MCQ saja
        const mcqOnly = questions.filter(q => q.question_type === 'MCQ');
        if (mcqOnly.length === 0) {
            alert('Belum ada soal MCQ di bank soal.');
            return;
        }

        // Shuffle & ambil 10
        const shuffled = [...mcqOnly].sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, 10);
        
        setSimQuestions(selected);
        setCurrentIndex(0);
        setScore(0);
        setShowResult(false);
        setIsSimulating(true);
        setSelectedOption(null);
        setIsAnswered(false);
    };

    const handleAnswer = (optionValue: string) => {
        if (isAnswered) return;
        
        setSelectedOption(optionValue);
        setIsAnswered(true);

        const currentQ = simQuestions[currentIndex];
        // Asumsi format jawaban dari backend: "A", "B", "C", "D" (Sesuai dengan option_a, dll)
        // Jika optionValue adalah teksnya langsung, harus dicek kebenarannya.
        // Di DB kita nyimpen "correct_answer" = "A" atau "B"
        // Kita bandingkan optionValue (A/B/C/D) dengan correct_answer
        
        if (optionValue === currentQ.correct_answer) {
            setScore(prev => prev + 1);
        }

        setTimeout(() => {
            if (currentIndex < simQuestions.length - 1) {
                setCurrentIndex(prev => prev + 1);
                setIsAnswered(false);
                setSelectedOption(null);
            } else {
                setShowResult(true);
            }
        }, 1500); // Jeda 1.5 detik untuk melihat jawaban benar/salah
    };

    if (!isSimulating) {
        return (
            <div className="bg-surface-bright border border-surface-variant rounded-[20px] p-6 shadow-sm">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-[16px] flex items-center justify-center text-primary">
                        <Play className="w-6 h-6 fill-primary" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-on-surface">Simulasi Kuis</h3>
                        <p className="text-sm text-secondary">Uji pemahamanmu dengan 10 soal acak</p>
                    </div>
                </div>
                <button 
                    onClick={startSimulation}
                    className="w-full bg-primary text-on-primary py-3 rounded-full font-bold active:scale-[0.98] transition-transform"
                >
                    Mulai Simulasi
                </button>
            </div>
        );
    }

    if (showResult) {
        return (
            <div className="bg-surface-bright border border-surface-variant rounded-[20px] p-6 shadow-sm text-center">
                <h3 className="font-bold text-2xl text-on-surface mb-2">Simulasi Selesai!</h3>
                <p className="text-secondary mb-6">Skor Akhir Kamu</p>
                <div className="text-5xl font-extrabold text-primary mb-8">
                    {Math.round((score / simQuestions.length) * 100)}
                </div>
                <p className="text-sm text-secondary mb-6">Benar {score} dari {simQuestions.length} soal</p>
                <button 
                    onClick={() => setIsSimulating(false)}
                    className="w-full bg-surface-container text-on-surface py-3 rounded-full font-bold active:scale-[0.98] transition-transform"
                >
                    Tutup
                </button>
            </div>
        );
    }

    const currentQ = simQuestions[currentIndex];
    
    const getOptionClass = (optKey: string) => {
        if (!isAnswered) {
            return selectedOption === optKey 
                ? 'border-primary bg-primary/10' 
                : 'border-surface-variant hover:border-primary/30';
        }

        if (optKey === currentQ.correct_answer) {
            return 'border-mint-bg bg-mint-bg/20 text-mint-fg'; // Jawaban Benar
        }

        if (selectedOption === optKey && optKey !== currentQ.correct_answer) {
            return 'border-red-500 bg-red-500/10 text-red-600'; // Jawaban Salah yang dipilih
        }

        return 'border-surface-variant opacity-50';
    };

    return (
        <div className="bg-surface-bright border border-surface-variant rounded-[20px] p-6 shadow-sm">
            <div className="flex justify-between items-center mb-6">
                <span className="text-xs font-bold text-primary bg-primary/10 px-3 py-1 rounded-full">
                    {currentQ.subject_name}
                </span>
                <span className="text-sm font-bold text-secondary">
                    {currentIndex + 1} / {simQuestions.length}
                </span>
            </div>

            <h4 className="text-lg font-bold text-on-surface mb-6 leading-snug">
                {currentQ.question_text}
            </h4>

            <div className="flex flex-col gap-3">
                {['A', 'B', 'C', 'D'].map((optKey) => {
                    const optText = currentQ[`option_${optKey.toLowerCase()}`];
                    if (!optText) return null;
                    return (
                        <button 
                            key={optKey}
                            disabled={isAnswered}
                            onClick={() => handleAnswer(optKey)}
                            className={`p-4 border-2 rounded-[16px] text-left transition-all flex items-center justify-between ${getOptionClass(optKey)}`}
                        >
                            <span className="font-medium">{optKey}. {optText}</span>
                            {isAnswered && optKey === currentQ.correct_answer && <CheckCircle className="w-5 h-5 text-mint-fg" />}
                            {isAnswered && selectedOption === optKey && optKey !== currentQ.correct_answer && <XCircle className="w-5 h-5 text-red-500" />}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
