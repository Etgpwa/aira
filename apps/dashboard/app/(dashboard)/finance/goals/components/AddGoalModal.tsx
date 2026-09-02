'use client';

import { useState, useTransition } from 'react';
import { Plus, X, Loader2, Check, Target, Calendar, Wallet } from 'lucide-react';
import { createGoal } from '../actions';

interface Account {
    id: string;
    name: string;
    balance: number;
}

interface AddGoalModalProps {
    accounts: Account[];
    triggerButton?: React.ReactNode;
}

export default function AddGoalModal({ accounts, triggerButton }: AddGoalModalProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [name, setName] = useState('');
    const [targetAmount, setTargetAmount] = useState('');
    const [initialAmount, setInitialAmount] = useState('');
    const [sourceAccountId, setSourceAccountId] = useState('');
    const [targetDate, setTargetDate] = useState('');

    const [isPending, startTransition] = useTransition();
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage('');
        setSuccessMessage('');

        const rawTarget = parseFloat(targetAmount.replace(/[^0-9.-]+/g, ''));
        const rawInitial = parseFloat(initialAmount.replace(/[^0-9.-]+/g, '')) || 0;

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
                await createGoal({
                    name: name.trim(),
                    targetAmount: rawTarget,
                    initialAmount: rawInitial,
                    targetDate: targetDate || null,
                    sourceAccountId: rawInitial > 0 && sourceAccountId ? sourceAccountId : null
                });

                setSuccessMessage('Target tabungan berhasil dibuat!');
                setTimeout(() => {
                    setIsOpen(false);
                    setName('');
                    setTargetAmount('');
                    setInitialAmount('');
                    setSourceAccountId('');
                    setTargetDate('');
                    setSuccessMessage('');
                }, 1000);
            } catch (err: any) {
                setErrorMessage(err?.message || 'Gagal membuat target tabungan');
            }
        });
    };

    return (
        <>
            {triggerButton ? (
                <div onClick={() => setIsOpen(true)}>{triggerButton}</div>
            ) : (
                <button
                    onClick={() => setIsOpen(true)}
                    className="w-10 h-10 rounded-full bg-primary hover:bg-primary-container text-on-primary flex items-center justify-center transition-all shadow-[0_4px_16px_rgba(56,74,216,0.3)] active:scale-95"
                    title="Buat Target Baru"
                >
                    <Plus className="w-5 h-5" />
                </button>
            )}

            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
                    <div className="bg-surface w-full max-w-lg rounded-t-[28px] sm:rounded-[28px] p-6 pb-10 sm:pb-6 shadow-2xl max-h-[90vh] overflow-y-auto border border-surface-variant">
                        {/* Header Modal */}
                        <div className="flex justify-between items-center mb-5">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                                    <Target className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-extrabold text-on-surface">Target Tabungan Baru</h2>
                                    <p className="text-xs text-secondary mt-0.5">Rencanakan impianmu secara terukur</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
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
                                    placeholder="Contoh: Beli Laptop Baru, Liburan Akhir Tahun"
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
                                        placeholder="10.000.000"
                                        className="w-full bg-surface-container border border-surface-variant rounded-xl pl-12 pr-4 py-3 text-on-surface text-base font-extrabold focus:outline-none focus:border-primary tabular-nums"
                                    />
                                </div>
                            </div>

                            {/* Setoran Awal (Opsional) */}
                            <div>
                                <label className="text-xs font-bold text-secondary mb-1.5 block">Setoran Awal (Opsional)</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-secondary text-sm">Rp</span>
                                    <input
                                        type="number"
                                        min="0"
                                        value={initialAmount}
                                        onChange={(e) => setInitialAmount(e.target.value)}
                                        placeholder="0"
                                        className="w-full bg-surface-container border border-surface-variant rounded-xl pl-12 pr-4 py-3 text-on-surface text-sm font-bold focus:outline-none focus:border-primary tabular-nums"
                                    />
                                </div>
                            </div>

                            {/* Sumber Rekening jika ada setoran awal */}
                            {Number(initialAmount) > 0 && accounts.length > 0 && (
                                <div>
                                    <label className="text-xs font-bold text-secondary mb-1.5 flex items-center gap-1.5">
                                        <Wallet className="w-3.5 h-3.5 text-primary" /> Potong Dari Rekening
                                    </label>
                                    <select
                                        value={sourceAccountId}
                                        onChange={(e) => setSourceAccountId(e.target.value)}
                                        className="w-full bg-surface-container border border-surface-variant rounded-xl px-4 py-3 text-on-surface text-sm font-semibold focus:outline-none focus:border-primary"
                                    >
                                        <option value="">-- Jangan potong rekening (hanya catat virtual) --</option>
                                        {accounts.map(acc => (
                                            <option key={acc.id} value={acc.id}>
                                                {acc.name} — (Saldo: Rp{Number(acc.balance).toLocaleString('id-ID')})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Target Tanggal Selesai */}
                            <div>
                                <label className="text-xs font-bold text-secondary mb-1.5 flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5 text-primary" /> Target Tercapai (Opsional)
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

                            {/* Tombol Simpan */}
                            <div className="flex gap-3 mt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsOpen(false)}
                                    className="flex-1 bg-surface-container hover:bg-surface-container-high text-secondary py-3 rounded-full font-bold text-sm"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={isPending}
                                    className="flex-1 bg-primary hover:bg-primary-container text-on-primary py-3 rounded-full font-bold text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(56,74,216,0.25)]"
                                >
                                    {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> Buat Target</>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
