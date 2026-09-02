'use client';

import { useState, useTransition } from 'react';
import { Target, CheckCircle2, TrendingUp, Plus, Edit2, Trash2, Loader2, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import EditGoalModal from './EditGoalModal';
import TopupGoalModal from './TopupGoalModal';
import { deleteGoal } from '../actions';

interface Goal {
    id: string;
    name: string;
    target_amount: number;
    current_amount: number;
    target_date?: string | null;
    status: string;
}

interface Account {
    id: string;
    name: string;
    balance: number;
}

interface GoalCardProps {
    goal: Goal;
    accounts: Account[];
}

export default function GoalCard({ goal, accounts }: GoalCardProps) {
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isTopupOpen, setIsTopupOpen] = useState(false);
    const [isPending, startTransition] = useTransition();

    const current = Number(goal.current_amount || 0);
    const target = Number(goal.target_amount || 0);
    const percent = Math.min(100, Math.round((current / target) * 100));
    const isCompleted = current >= target;

    const formatRupiah = (num: number) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
    };

    const handleDelete = () => {
        if (!confirm(`Hapus target tabungan "${goal.name}"?`)) return;

        startTransition(async () => {
            try {
                await deleteGoal(goal.id);
            } catch (err: any) {
                alert(err?.message || 'Gagal menghapus target');
            }
        });
    };

    return (
        <>
            <div className="bg-surface-bright rounded-[24px] p-5 border border-surface-variant shadow-[0_8px_24px_rgba(24,26,42,0.04)] relative overflow-hidden flex flex-col justify-between">
                {/* Badge Selesai */}
                {isCompleted && (
                    <div className="absolute top-0 right-0 w-16 h-16 bg-mint-bg rounded-bl-full flex items-start justify-end p-2 z-0">
                        <CheckCircle2 className="w-5 h-5 text-mint-fg relative -top-1 -right-1" />
                    </div>
                )}

                <div className="relative z-10">
                    {/* Header Card: Icon + Nama + Aksi Edit/Delete */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary flex-shrink-0">
                                <Target className="w-6 h-6 text-primary" />
                            </div>
                            <div className="min-w-0">
                                <h4 className="font-extrabold text-on-surface text-base truncate">{goal.name}</h4>
                                <p className="text-xs text-secondary mt-0.5 flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {goal.target_date
                                        ? format(new Date(goal.target_date), 'd MMM yyyy', { locale: id })
                                        : 'Kapan saja'
                                    }
                                </p>
                            </div>
                        </div>

                        {/* Tombol Edit & Delete */}
                        <div className="flex items-center gap-1 bg-surface-container/60 p-1 rounded-xl">
                            <button
                                onClick={() => setIsEditOpen(true)}
                                className="w-7 h-7 rounded-lg hover:bg-surface-container flex items-center justify-center text-secondary hover:text-primary transition-colors"
                                title="Edit Target"
                            >
                                <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={isPending}
                                className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center text-secondary hover:text-red-500 transition-colors"
                                title="Hapus Target"
                            >
                                {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            </button>
                        </div>
                    </div>

                    {/* Progress Bar & Nominal */}
                    <div className="flex justify-between items-end mb-2">
                        <p className="font-extrabold text-on-surface text-base tabular-nums">{formatRupiah(current)}</p>
                        <p className="text-xs text-secondary font-medium">dari {formatRupiah(target)}</p>
                    </div>

                    <div className="w-full bg-surface-variant rounded-full h-3 overflow-hidden mb-3">
                        <div
                            className={`h-full rounded-full transition-all duration-1000 ${isCompleted ? 'bg-mint-fg' : 'bg-primary'}`}
                            style={{ width: `${percent}%` }}
                        />
                    </div>

                    <div className="flex justify-between items-center text-xs mb-4">
                        <span className={`font-bold ${isCompleted ? 'text-mint-fg' : 'text-primary'}`}>
                            {percent}% Tercapai
                        </span>
                        {!isCompleted && (
                            <span className="flex items-center gap-1 text-secondary font-medium">
                                <TrendingUp className="w-3.5 h-3.5 text-mint-fg" />
                                Sisa {formatRupiah(Math.max(0, target - current))}
                            </span>
                        )}
                    </div>
                </div>

                {/* Tombol Setor / Top Up */}
                <div className="relative z-10 pt-2 border-t border-surface-variant/40">
                    <button
                        onClick={() => setIsTopupOpen(true)}
                        className={`w-full py-2.5 rounded-full font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] ${isCompleted
                            ? 'bg-surface-container hover:bg-surface-container-high text-on-surface'
                            : 'bg-primary hover:bg-primary-container text-on-primary shadow-sm'
                            }`}
                    >
                        <Plus className="w-3.5 h-3.5" /> Setor Tabungan
                    </button>
                </div>
            </div>

            {/* Modals */}
            <EditGoalModal
                goal={goal}
                isOpen={isEditOpen}
                onClose={() => setIsEditOpen(false)}
            />

            <TopupGoalModal
                goal={goal}
                accounts={accounts}
                isOpen={isTopupOpen}
                onClose={() => setIsTopupOpen(false)}
            />
        </>
    );
}
