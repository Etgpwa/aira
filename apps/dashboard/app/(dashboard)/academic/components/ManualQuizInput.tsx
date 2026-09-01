'use client';

import { useState } from 'react';
import { PlusCircle, Upload, Loader2, Check } from 'lucide-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';

export default function ManualQuizInput({ userId }: { userId: string }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const router = useRouter();

    const [form, setForm] = useState({
        subject_name: '',
        question_type: 'MCQ',
        question_text: '',
        option_a: '',
        option_b: '',
        option_c: '',
        option_d: '',
        correct_answer: 'A'
    });

    const supabase = createClientComponentClient();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setSuccess(false);

        try {
            const currentWkRes = await supabase
                .from('user_settings')
                .select('semester_start_date')
                .eq('user_id', userId)
                .single();
            
            // Simplified week calculation for frontend or default to null
            const weekNumber = null; // Biarkan null agar berlaku umum

            const insertData = {
                user_id: userId,
                subject_name: form.subject_name,
                week_number: weekNumber,
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
            setForm({
                subject_name: '',
                question_type: 'MCQ',
                question_text: '',
                option_a: '',
                option_b: '',
                option_c: '',
                option_d: '',
                correct_answer: 'A'
            });
            setTimeout(() => {
                setIsOpen(false);
                setSuccess(false);
                router.refresh();
            }, 2000);

        } catch (err) {
            console.error("Error inserting question", err);
            alert("Gagal menyimpan soal");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) {
        return (
            <button 
                onClick={() => setIsOpen(true)}
                className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-primary/30 rounded-[20px] text-primary font-bold hover:bg-primary/5 transition-colors active:scale-[0.98]"
            >
                <PlusCircle className="w-5 h-5" /> Input Soal Manual
            </button>
        );
    }

    return (
        <div className="bg-surface-bright border border-surface-variant rounded-[20px] p-6 shadow-sm">
            <h3 className="font-bold text-lg text-on-surface mb-4 flex items-center gap-2">
                <Upload className="w-5 h-5 text-primary" /> Input Soal Baru
            </h3>
            
            {success ? (
                <div className="bg-mint-bg/20 border border-mint-bg rounded-[16px] p-4 text-mint-fg flex items-center gap-3">
                    <Check className="w-6 h-6" />
                    <p className="font-bold">Soal berhasil ditambahkan ke Bank Soal!</p>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div>
                        <label className="text-xs font-bold text-secondary mb-1 block">Mata Kuliah</label>
                        <input 
                            required
                            type="text" 
                            className="w-full bg-surface border border-surface-variant rounded-xl p-3 text-on-surface focus:outline-none focus:border-primary" 
                            placeholder="Contoh: Pemrograman Web"
                            value={form.subject_name}
                            onChange={e => setForm({...form, subject_name: e.target.value})}
                        />
                    </div>
                    
                    <div>
                        <label className="text-xs font-bold text-secondary mb-1 block">Tipe Soal</label>
                        <select 
                            className="w-full bg-surface border border-surface-variant rounded-xl p-3 text-on-surface focus:outline-none focus:border-primary"
                            value={form.question_type}
                            onChange={e => setForm({...form, question_type: e.target.value as 'MCQ' | 'ESSAY'})}
                        >
                            <option value="MCQ">Pilihan Ganda (MCQ)</option>
                            <option value="ESSAY">Essay</option>
                        </select>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-secondary mb-1 block">Pertanyaan</label>
                        <textarea 
                            required
                            className="w-full bg-surface border border-surface-variant rounded-xl p-3 text-on-surface focus:outline-none focus:border-primary min-h-[100px]" 
                            placeholder="Tulis pertanyaan di sini..."
                            value={form.question_text}
                            onChange={e => setForm({...form, question_text: e.target.value})}
                        />
                    </div>

                    {form.question_type === 'MCQ' && (
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-bold text-secondary mb-1 block">Opsi A</label>
                                <input required type="text" className="w-full bg-surface border border-surface-variant rounded-xl p-2 text-sm text-on-surface" 
                                    value={form.option_a} onChange={e => setForm({...form, option_a: e.target.value})} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-secondary mb-1 block">Opsi B</label>
                                <input required type="text" className="w-full bg-surface border border-surface-variant rounded-xl p-2 text-sm text-on-surface" 
                                    value={form.option_b} onChange={e => setForm({...form, option_b: e.target.value})} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-secondary mb-1 block">Opsi C</label>
                                <input required type="text" className="w-full bg-surface border border-surface-variant rounded-xl p-2 text-sm text-on-surface" 
                                    value={form.option_c} onChange={e => setForm({...form, option_c: e.target.value})} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-secondary mb-1 block">Opsi D</label>
                                <input required type="text" className="w-full bg-surface border border-surface-variant rounded-xl p-2 text-sm text-on-surface" 
                                    value={form.option_d} onChange={e => setForm({...form, option_d: e.target.value})} />
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="text-xs font-bold text-secondary mb-1 block">Jawaban Benar</label>
                        {form.question_type === 'MCQ' ? (
                            <select 
                                className="w-full bg-surface border border-surface-variant rounded-xl p-3 text-on-surface focus:outline-none focus:border-primary"
                                value={form.correct_answer}
                                onChange={e => setForm({...form, correct_answer: e.target.value})}
                            >
                                <option value="A">A</option>
                                <option value="B">B</option>
                                <option value="C">C</option>
                                <option value="D">D</option>
                            </select>
                        ) : (
                            <textarea 
                                required
                                className="w-full bg-surface border border-surface-variant rounded-xl p-3 text-on-surface focus:outline-none focus:border-primary min-h-[80px]" 
                                placeholder="Tulis jawaban essay/kunci jawaban..."
                                value={form.correct_answer}
                                onChange={e => setForm({...form, correct_answer: e.target.value})}
                            />
                        )}
                    </div>

                    <div className="flex gap-3 mt-4">
                        <button 
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="flex-1 bg-surface-container text-on-surface py-3 rounded-full font-bold active:scale-[0.98] transition-transform"
                        >
                            Batal
                        </button>
                        <button 
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 bg-primary text-on-primary py-3 rounded-full font-bold active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Simpan'}
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}
