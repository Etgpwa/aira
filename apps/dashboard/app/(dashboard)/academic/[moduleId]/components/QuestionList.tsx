'use client';

import { useState, useTransition } from 'react';
import { Trash2, Wand2, Sparkles, ChevronDown, ChevronUp, Loader2, Check, Edit3, X } from 'lucide-react';
import { deleteQuestion, paraphraseQuestion, generateDistractors, updateQuestion } from '../../actions';
import { useRouter } from 'next/navigation';

interface QuestionListProps {
    questions: any[];
    moduleId: string;
}

export default function QuestionList({ questions, moduleId }: QuestionListProps) {
    return (
        <div className="flex flex-col gap-2">
            {questions.map((q, idx) => (
                <QuestionCard key={q.id} question={q} index={idx} moduleId={moduleId} />
            ))}
        </div>
    );
}

function QuestionCard({ question, index, moduleId }: { question: any; index: number; moduleId: string }) {
    const [expanded, setExpanded] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [actionStatus, setActionStatus] = useState('');
    const router = useRouter();

    const [editData, setEditData] = useState({
        question_text: question.question_text,
        question_type: question.question_type,
        option_a: question.option_a || '',
        option_b: question.option_b || '',
        option_c: question.option_c || '',
        option_d: question.option_d || '',
        correct_answer: question.correct_answer,
    });

    const handleDelete = () => {
        if (!confirm('Hapus soal ini?')) return;
        startTransition(async () => {
            await deleteQuestion(question.id, moduleId);
            router.refresh();
        });
    };

    const handleParaphrase = () => {
        setActionStatus('Membuat parafrase soal...');
        startTransition(async () => {
            try {
                await paraphraseQuestion(question.id, moduleId);
                setActionStatus('Parafrase soal berhasil ditambahkan!');
                router.refresh();
            } catch {
                setActionStatus('Gagal membuat parafrase.');
            }
        });
    };

    const handleGenerateDistractors = () => {
        setActionStatus('Membuat pilihan ganda dari soal essay...');
        startTransition(async () => {
            try {
                const ok = await generateDistractors(question.id, moduleId);
                setActionStatus(ok ? 'Soal berhasil diubah ke MCQ!' : 'Gagal generate pilihan ganda.');
                router.refresh();
            } catch {
                setActionStatus('Terjadi kesalahan.');
            }
        });
    };

    const handleSaveEdit = () => {
        startTransition(async () => {
            await updateQuestion(question.id, editData);
            setIsEditing(false);
            router.refresh();
        });
    };

    const typeColor = question.question_type === 'MCQ'
        ? 'bg-primary/10 text-primary'
        : 'bg-peach-bg text-peach-fg';

    return (
        <div className="bg-surface-bright border border-surface-variant rounded-[14px] overflow-hidden">
            {/* Header Row */}
            <button
                className="w-full flex items-center gap-2.5 p-3.5 text-left"
                onClick={() => setExpanded(e => !e)}
            >
                <span className="text-xs font-bold text-secondary w-5 flex-shrink-0">{index + 1}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${typeColor}`}>
                    {question.question_type}
                </span>
                <p className="flex-1 text-sm text-on-surface font-medium truncate">{question.question_text}</p>
                {question.correct_answer && question.correct_answer !== '?' && (
                    <span className="text-[10px] bg-mint-bg text-mint-fg px-1.5 py-0.5 rounded-full font-bold flex-shrink-0">
                        ✓ {question.correct_answer}
                    </span>
                )}
                {expanded ? <ChevronUp className="w-4 h-4 text-secondary flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-secondary flex-shrink-0" />}
            </button>

            {/* Expanded Content */}
            {expanded && (
                <div className="border-t border-surface-variant px-3.5 pb-3.5 pt-3">
                    {isEditing ? (
                        // ── Edit Mode ──────────────────────────────
                        <div className="flex flex-col gap-2.5">
                            <textarea
                                className="w-full bg-surface border border-surface-variant rounded-xl px-3 py-2 text-sm text-on-surface focus:outline-none resize-none"
                                rows={3}
                                value={editData.question_text}
                                onChange={e => setEditData({ ...editData, question_text: e.target.value })}
                            />
                            {editData.question_type === 'MCQ' && (
                                <div className="grid grid-cols-2 gap-1.5">
                                    {['a', 'b', 'c', 'd'].map(opt => (
                                        <input
                                            key={opt}
                                            className="bg-surface border border-surface-variant rounded-lg px-2 py-1.5 text-xs text-on-surface focus:outline-none"
                                            value={(editData as any)[`option_${opt}`]}
                                            onChange={e => setEditData({ ...editData, [`option_${opt}`]: e.target.value })}
                                            placeholder={`Opsi ${opt.toUpperCase()}`}
                                        />
                                    ))}
                                </div>
                            )}
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-secondary">Jawaban Benar:</span>
                                <input
                                    className="w-20 bg-mint-bg/30 border border-mint-fg/30 text-mint-fg rounded-lg px-2 py-1 text-xs font-bold text-center focus:outline-none"
                                    value={editData.correct_answer}
                                    onChange={e => setEditData({ ...editData, correct_answer: e.target.value })}
                                />
                            </div>
                            <div className="flex gap-2 mt-1">
                                <button onClick={() => setIsEditing(false)} className="flex-1 bg-surface-container text-secondary py-2 rounded-full text-xs font-bold">Batal</button>
                                <button onClick={handleSaveEdit} disabled={isPending} className="flex-1 bg-primary text-on-primary py-2 rounded-full text-xs font-bold flex items-center justify-center gap-1">
                                    {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Check className="w-3.5 h-3.5" /> Simpan</>}
                                </button>
                            </div>
                        </div>
                    ) : (
                        // ── View Mode ─────────────────────────────
                        <div>
                            <p className="text-sm text-on-surface mb-2">{question.question_text}</p>
                            {question.question_type === 'MCQ' && (
                                <div className="flex flex-col gap-1 mb-3">
                                    {['a', 'b', 'c', 'd'].map(opt => {
                                        const val = question[`option_${opt}`];
                                        if (!val) return null;
                                        const isCorrect = question.correct_answer === opt.toUpperCase();
                                        return (
                                            <div key={opt} className={`flex items-start gap-2 px-2.5 py-1.5 rounded-lg text-xs ${isCorrect ? 'bg-mint-bg/30 text-mint-fg font-bold' : 'text-secondary'}`}>
                                                <span className="font-bold uppercase">{opt}.</span>
                                                <span>{val}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            {question.question_type === 'ESSAY' && (
                                <div className="bg-mint-bg/20 rounded-lg px-2.5 py-1.5 text-xs text-mint-fg font-medium mb-3">
                                    Jawaban: {question.correct_answer}
                                </div>
                            )}

                            {/* Status / Feedback */}
                            {(isPending || actionStatus) && (
                                <p className={`text-xs mb-2 ${isPending ? 'text-primary' : 'text-mint-fg'}`}>
                                    {isPending ? '⏳ Memproses...' : `✓ ${actionStatus}`}
                                </p>
                            )}

                            {/* Action Buttons */}
                            <div className="flex gap-1.5 flex-wrap">
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-surface-container text-secondary rounded-full text-xs font-bold"
                                >
                                    <Edit3 className="w-3 h-3" /> Edit
                                </button>
                                <button
                                    onClick={handleParaphrase}
                                    disabled={isPending}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-primary/10 text-primary rounded-full text-xs font-bold"
                                >
                                    <Wand2 className="w-3 h-3" /> Parafrase
                                </button>
                                {question.question_type === 'ESSAY' && (
                                    <button
                                        onClick={handleGenerateDistractors}
                                        disabled={isPending}
                                        className="flex items-center gap-1 px-3 py-1.5 bg-peach-bg text-peach-fg rounded-full text-xs font-bold"
                                    >
                                        <Sparkles className="w-3 h-3" /> → MCQ
                                    </button>
                                )}
                                <button
                                    onClick={handleDelete}
                                    disabled={isPending}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-500 rounded-full text-xs font-bold ml-auto"
                                >
                                    <Trash2 className="w-3 h-3" /> Hapus
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
