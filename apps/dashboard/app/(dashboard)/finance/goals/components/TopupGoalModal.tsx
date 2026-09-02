'use client';

import { useState, useTransition } from 'react';
import { X, Loader2, Check, ArrowDownLeft, Wallet, PiggyBank } from 'lucide-react';
import { topupGoal } from '../actions';

interface Goal {
    id: string;
    name: string;
    target_amount: number;
    current_amount: number;
}

interface Account {
    id: string;
    name: string;
    balance: number;
}

interface TopupGoalModalProps {
    goal: Goal;
    accounts: Account[];
    isOpen: boolean;
    onClose: () => void;
}

export default function TopupGoalModal({ goal, accounts, isOpen, onClose }: TopupGoalModalProps) {
    const [amount, setAmount] = useState('');
    const [sourceAccountId, setSourceAccountId] = useState(accounts[0]?.id || '');
    const [isPending, startTransition] = useTransition();
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    if (!isOpen) return null;

    const remaining = Number(goal.target_amount) - Number(goal.current_amount);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage('');
        setSuccessMessage('');

        const rawAmount = parseFloat(amount.replace(/[^0-9.-]+/g, ''));
        if (!rawAmount || rawAmount <= 0) {
            setErrorMessage('Nominal setoran harus lebih dari 0');
            return;
        }

        startTransition(async () => {
            try {
                await topupGoal({
                    id: goal.id,
                    amount: rawAmount,
                    sourceAccountId: sourceAccountId || null
                });

                setSuccessMessage(`Setoran Rp${rawAmount.toLocaleString('id-ID')} berhasil ditambahkan ke ${goal.name}!`);
                setTimeout(() => {
                    onClose();
                    setAmount('');
                    setSuccessMessage('');
                }, 1000);
            } catch (err: any) {
                setErrorMessage(err?.message || 'Gagal menambahkan setoran tabungan');
            }
        });
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
            <div className="bg-surface w-full max-w-lg rounded-t-[28px] sm:rounded-[28px] p-6 pb-28 sm:pb-6 shadow-2xl max-h-[88dvh] overflow-y-auto border border-surface-variant flex flex-col">
                {/* Header Modal */}
                <div className="flex justify-between items-center mb-5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-mint-bg flex items-center justify-center text-mint-fg">
                            <PiggyBank className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-extrabold text-on-surface">Setor Tabungan</h2>
                            <p className="text-xs text-secondary mt-0.5">Tambah tabungan untuk "{goal.name}"</p>
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
                    {/* Ringkasan Target */}
                    <div className="p-3.5 bg-surface-container-low rounded-2xl border border-surface-variant/50 flex justify-between items-center">
                        <div>
                            <p className="text-[11px] text-secondary font-medium">Terkumpul Saat Ini</p>
                            <p className="text-sm font-extrabold text-on-surface tabular-nums">
                                Rp{Number(goal.current_amount).toLocaleString('id-ID')}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-[11px] text-secondary font-medium">Sisa Target</p>
                            <p className="text-sm font-extrabold text-primary tabular-nums">
                                Rp{Math.max(0, remaining).toLocaleString('id-ID')}
                            </p>
                        </div>
                    </div>

                    {/* Nominal Setoran */}
                    <div>
                        <label className="text-xs font-bold text-secondary mb-1.5 block">Nominal Setoran (Rp) *</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-secondary text-sm">Rp</span>
                            <input
                                type="number"
                                required
                                min="1"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="500.000"
                                className="w-full bg-surface-container border border-surface-variant rounded-xl pl-12 pr-4 py-3 text-on-surface text-base font-extrabold focus:outline-none focus:border-primary tabular-nums"
                            />
                        </div>
                    </div>

                    {/* Rekening Sumber */}
                    {accounts.length > 0 && (
                        <div>
                            <label className="text-xs font-bold text-secondary mb-1.5 flex items-center gap-1.5">
                                <Wallet className="w-3.5 h-3.5 text-primary" /> Sumber Rekening / Dompet
                            </label>
                            <select
                                value={sourceAccountId}
                                onChange={(e) => setSourceAccountId(e.target.value)}
                                className="w-full bg-surface-container border border-surface-variant rounded-xl px-4 py-3 text-on-surface text-sm font-semibold focus:outline-none focus:border-primary"
                            >
                                <option value="">-- Jangan potong rekening (hanya tambah virtual) --</option>
                                {accounts.map(acc => (
                                    <option key={acc.id} value={acc.id}>
                                        {acc.name} — (Saldo: Rp{Number(acc.balance).toLocaleString('id-ID')})
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

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
                            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ArrowDownLeft className="w-4 h-4" /> Setor Sekarang</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
