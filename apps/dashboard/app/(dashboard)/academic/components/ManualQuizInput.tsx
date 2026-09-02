'use client';

import { useState, useTransition } from 'react';
import { PlusCircle, Loader2, Check, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface ManualQuizInputProps {
    userId: string;
    moduleId: string;
    subjectName: string;
    onClose?: () => void;
}

export default function ManualQuizInput({ userId, moduleId, subjectName, onClose }: ManualQuizInputProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const router = useRouter();
    const supabase = createClient();

    const [form, setForm] = useState({
        question_type: 'MCQ',
        question_text: '',
        option_a: '',
        option_b: '',
        option_c: '',
        option_d: '',
        correct_answer: 'A'
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setSuccess(false);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            const insertData = {
                user_id: user.id,
                module_id: moduleId || null,
                subject_name: subjectName,
                question_text: form.question_text,
                question_type: form.question_type,
                option_a: form.question_type === 'MCQ' ? form.option_a : null,
                option_b: form.question_type === 'MCQ' ? form.option_b : null,
                option_c: form.question_type === 'MCQ' ? form.option_c : null,
                option_d: form.question_type === 'MCQ' ? form.option_d : null,
                correct_answer: form.correct_answer,
                already_asked: false
            };

            const { error } = await supabase.from('course_quiz_questions').insert(insertData);
            if (error) throw error;

            setSuccess(true);
            setForm({ question_type: 'MCQ', question_text: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_answer: 'A' });
            router.refresh();
            
            setTimeout(() => {
                setSuccess(false);
            }, 2000);
        } catch (err) {
            console.error(err);
            alert('Gagal menyimpan soal');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="bg-surface-bright border border-surface-variant rounded-[16px] p-4">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-on-surface flex items-center gap-2">
                    <PlusCircle className="w-4 h-4 text-mint-fg" /> Input Soal Manual
                </h3>
                {onClose && (
                    <button onClick={onClose} className="w-7 h-7 rounded-full bg-surface-container flex items-center justify-center text-secondary">
                        <X className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>

            {success ? (
                <div className="bg-mint-bg/20 rounded-[12px] p-3 flex items-center gap-2 text-mint-fg">
                    <Check className="w-5 h-5" />
                    <p className="font-bold text-sm">Soal berhasil disimpan!</p>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                    <div>
                        <label className="text-xs font-bold text-secondary mb-1 block">Tipe Soal</label>
                        <select
                            className="w-full bg-surface border border-surface-variant rounded-xl p-2.5 text-sm text-on-surface focus:outline-none"
                            value={form.question_type}
                            onChange={e => setForm({ ...form, question_type: e.target.value })}
                        >
                            <option value="MCQ">Pilihan Ganda (MCQ)</option>
                            <option value="ESSAY">Essay</option>
                        </select>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-secondary mb-1 block">Pertanyaan *</label>
                        <textarea
                            required
                            className="w-full bg-surface border border-surface-variant rounded-xl p-2.5 text-sm text-on-surface focus:outline-none min-h-[80px] resize-none"
                            placeholder="Tulis pertanyaan..."
                            value={form.question_text}
                            onChange={e => setForm({ ...form, question_text: e.target.value })}
                        />
                    </div>

                    {form.question_type === 'MCQ' && (
                        <div className="grid grid-cols-2 gap-2">
                            {['a', 'b', 'c', 'd'].map(opt => (
                                <div key={opt}>
                                    <label className="text-xs font-bold text-secondary mb-1 block">Opsi {opt.toUpperCase()}</label>
                                    <input
                                        required
                                        type="text"
                                        className="w-full bg-surface border border-surface-variant rounded-xl p-2 text-xs text-on-surface focus:outline-none"
                                        value={(form as any)[`option_${opt}`]}
                                        onChange={e => setForm({ ...form, [`option_${opt}`]: e.target.value })}
                                    />
                                </div>
                            ))}
                        </div>
                    )}

                    <div>
                        <label className="text-xs font-bold text-secondary mb-1 block">Jawaban Benar</label>
                        {form.question_type === 'MCQ' ? (
                            <select
                                className="w-full bg-surface border border-surface-variant rounded-xl p-2.5 text-sm text-on-surface"
                                value={form.correct_answer}
                                onChange={e => setForm({ ...form, correct_answer: e.target.value })}
                            >
                                {['A', 'B', 'C', 'D'].map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                        ) : (
                            <textarea
                                required
                                className="w-full bg-surface border border-surface-variant rounded-xl p-2.5 text-sm text-on-surface focus:outline-none min-h-[60px] resize-none"
                                placeholder="Kunci jawaban essay..."
                                value={form.correct_answer}
                                onChange={e => setForm({ ...form, correct_answer: e.target.value })}
                            />
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full bg-mint-fg text-white py-2.5 rounded-full font-bold text-sm flex items-center justify-center gap-2 mt-1"
                    >
                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> Simpan Soal</>}
                    </button>
                </form>
            )}
        </div>
    );
}
