'use client';

import { useState, useTransition } from 'react';
import { X, Loader2, Check, Edit2, Target, Calendar } from 'lucide-react';
import { updateGoal } from '../actions';

interface Goal {
    id: string;
    name: string;
    target_amount: number;
    current_amount: number;
    target_date?: string | null;
}

interface EditGoalModalProps {
    goal: Goal;
    isOpen: boolean;
    onClose: () => void;
}

export default function EditGoalModal({ goal, isOpen, onClose }: EditGoalModalProps) {
    const [name, setName] = useState(goal.name);
    const [targetAmount, setTargetAmount] = useState(String(goal.target_amount));
    const [targetDate, setTargetDate] = useState(
        goal.target_date ? new Date(goal.target_date).toISOString().slice(0, 10) : ''
    );

    const [isPending, startTransition] = useTransition();
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage('');
        setSuccessMessage('');

        const rawTarget = parseFloat(targetAmount.replace(/[^0-9.-]+/g, ''));
        if (!name.trim()) {
            setErrorMessage('Nama target tabungan harus diisi');
            return;
        }

        if (!rawTarget || rawTarget <= 0) {
            setErrorMessage('Target nominal harus lebih dari 0');
            return;
        }

        startTransition(async () => {
            try {
                await updateGoal({
                    id: goal.id,
                    name: name.trim(),
                    targetAmount: rawTarget,
                    targetDate: targetDate || null
                });

                setSuccessMessage('Target tabungan berhasil diperbarui!');
                setTimeout(() => {
                    onClose();
                    setSuccessMessage('');
                }, 1000);
            } catch (err: any) {
                setErrorMessage(err?.message || 'Gagal memperbarui target tabungan');
            }
        });
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
            <div className="bg-surface w-full max-w-lg rounded-t-[28px] sm:rounded-[28px] p-6 pb-28 sm:pb-6 shadow-2xl max-h-[88dvh] overflow-y-auto border border-surface-variant flex flex-col">
                {/* Header Modal */}
                <div className="flex justify-between items-center mb-5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                            <Edit2 className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-extrabold text-on-surface">Edit Target Tabungan</h2>
                            <p className="text-xs text-secondary mt-0.5">Ubah nama, target nominal, atau tanggal target</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-secondary hover:text-on-surface"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    {/* Nama Target */}
                    <div>
                        <label className="text-xs font-bold text-secondary mb-1.5 block">Nama Target / Impian *</label>
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Contoh: Beli Laptop Baru"
                            className="w-full bg-surface-container border border-surface-variant rounded-xl px-4 py-3 text-on-surface text-sm font-semibold focus:outline-none focus:border-primary"
                        />
                    </div>

                    {/* Target Nominal */}
                    <div>
                        <label className="text-xs font-bold text-secondary mb-1.5 block">Target Nominal (Rp) *</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-secondary text-sm">Rp</span>
                            <input
                                type="number"
                                required
                                min="1"
                                value={targetAmount}
                                onChange={(e) => setTargetAmount(e.target.value)}
                                className="w-full bg-surface-container border border-surface-variant rounded-xl pl-12 pr-4 py-3 text-on-surface text-base font-extrabold focus:outline-none focus:border-primary tabular-nums"
                            />
                        </div>
                    </div>

                    {/* Target Tanggal Selesai */}
                    <div>
                        <label className="text-xs font-bold text-secondary mb-1.5 flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-primary" /> Target Tercapai
                        </label>
                        <input
                            type="date"
                            value={targetDate}
                            onChange={(e) => setTargetDate(e.target.value)}
                            className="w-full bg-surface-container border border-surface-variant rounded-xl px-4 py-3 text-on-surface text-sm font-semibold focus:outline-none focus:border-primary"
                        />
                    </div>

                    {/* Pesan Feedback */}
                    {successMessage && (
                        <div className="p-3 bg-mint-bg/30 text-mint-fg rounded-xl text-xs font-bold flex items-center gap-2">
                            <Check className="w-4 h-4" /> {successMessage}
                        </div>
                    )}
                    {errorMessage && (
                        <div className="p-3 bg-red-50 text-danger rounded-xl text-xs font-bold">
                            {errorMessage}
                        </div>
                    )}

                    {/* Tombol Aksi */}
                    <div className="flex gap-3 mt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 bg-surface-container hover:bg-surface-container-high text-secondary py-3 rounded-full font-bold text-sm"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={isPending}
                            className="flex-1 bg-primary hover:bg-primary-container text-on-primary py-3 rounded-full font-bold text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(56,74,216,0.25)]"
                        >
                            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> Simpan Perubahan</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
