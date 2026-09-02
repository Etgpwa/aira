'use client';

import { useState, useTransition } from 'react';
import { ArrowDownLeft, ArrowUpRight, RotateCcw, Trash2, Loader2, Check, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { deleteTransaction, cancelLastTransaction } from '../actions';

interface TransactionItem {
    id: string;
    amount: number;
    currency: string;
    type: 'income' | 'expense' | 'transfer';
    description?: string | null;
    transaction_date: string;
    transaction_categories?: { name: string } | null;
    bank_accounts?: { name: string } | null;
}

interface TransactionHistoryListProps {
    transactions: TransactionItem[];
}

export default function TransactionHistoryList({ transactions }: TransactionHistoryListProps) {
    const [isPending, startTransition] = useTransition();
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    const formatRupiah = (num: number) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
    };

    const handleDelete = (tx: TransactionItem) => {
        const title = tx.transaction_categories?.name || tx.description || 'Transaksi';
        const nominal = formatRupiah(Number(tx.amount));
        const bankName = tx.bank_accounts?.name || 'rekening';
        const actionText = tx.type === 'expense' ? `dikembalikan ke ${bankName}` : `dipotong kembali dari ${bankName}`;

        const isConfirmed = confirm(
            `Batalkan transaksi "${title}" senilai ${nominal}?\n\nSaldo sebesar ${nominal} akan otomatis ${actionText}.`
        );

        if (!isConfirmed) return;

        setDeletingId(tx.id);
        setErrorMessage('');
        setSuccessMessage('');

        startTransition(async () => {
            try {
                await deleteTransaction(tx.id);
                setSuccessMessage(`Transaksi "${title}" berhasil dibatalkan & saldo telah dipulihkan!`);
                setTimeout(() => setSuccessMessage(''), 3000);
            } catch (err: any) {
                setErrorMessage(err?.message || 'Gagal membatalkan transaksi');
            } finally {
                setDeletingId(null);
            }
        });
    };

    const handleCancelLast = () => {
        if (transactions.length === 0) return;
        const lastTx = transactions[0];
        handleDelete(lastTx);
    };

    return (
        <div className="flex flex-col gap-3">
            {/* Header Riwayat + Tombol Batal Terakhir */}
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-on-surface">Riwayat Transaksi</h3>

                {transactions.length > 0 && (
                    <button
                        onClick={handleCancelLast}
                        disabled={isPending}
                        className="text-xs font-bold text-primary hover:text-primary-container flex items-center gap-1 bg-surface-container px-3 py-1.5 rounded-full transition-colors active:scale-95"
                        title="Batalkan transaksi yang baru saja dicatat"
                    >
                        <RotateCcw className="w-3.5 h-3.5" /> Batal Terakhir
                    </button>
                )}
            </div>

            {/* Feedback Message */}
            {successMessage && (
                <div className="p-3 bg-mint-bg/30 text-mint-fg rounded-2xl text-xs font-bold flex items-center gap-2">
                    <Check className="w-4 h-4 flex-shrink-0" /> {successMessage}
                </div>
            )}
            {errorMessage && (
                <div className="p-3 bg-red-50 text-danger rounded-2xl text-xs font-bold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" /> {errorMessage}
                </div>
            )}

            {/* Card List Transaksi */}
            <div className="bg-surface-bright rounded-[24px] border border-surface-variant shadow-[0_8px_24px_rgba(24,26,42,0.04)] p-2">
                <div className="flex flex-col gap-1">
                    {transactions.map(tx => {
                        const isThisDeleting = deletingId === tx.id;
                        const catName = tx.transaction_categories?.name || tx.description || 'Transaksi';
                        const bankName = tx.bank_accounts?.name || 'Kas';

                        return (
                            <div
                                key={tx.id}
                                className="group flex items-center justify-between p-3 hover:bg-surface-container-low transition-colors rounded-2xl gap-3"
                            >
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${tx.type === 'expense' ? 'bg-peach-bg text-peach-fg' : 'bg-mint-bg text-mint-fg'}`}>
                                        {tx.type === 'expense' ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownLeft className="w-5 h-5" />}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-on-surface truncate">{catName}</p>
                                        <p className="text-xs text-secondary mt-0.5 truncate">
                                            {format(new Date(tx.transaction_date), 'dd MMM yyyy', { locale: id })} • {bankName}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <p className={`text-sm font-bold tabular-nums text-right ${tx.type === 'expense' ? 'text-on-surface' : 'text-mint-fg'}`}>
                                        {tx.type === 'expense' ? '-' : '+'}{formatRupiah(Number(tx.amount))}
                                    </p>

                                    {/* Tombol Batalkan / Hapus */}
                                    <button
                                        onClick={() => handleDelete(tx)}
                                        disabled={isPending}
                                        className="w-8 h-8 rounded-xl bg-surface-container hover:bg-red-50 hover:text-danger text-secondary flex items-center justify-center transition-colors opacity-80 hover:opacity-100"
                                        title="Batalkan transaksi ini & kembalikan saldo"
                                    >
                                        {isThisDeleting ? (
                                            <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                        ) : (
                                            <RotateCcw className="w-3.5 h-3.5" />
                                        )}
                                    </button>
                                </div>
                            </div>
                        );
                    })}

                    {transactions.length === 0 && (
                        <p className="text-center text-sm text-secondary py-8">
                            Belum ada riwayat transaksi.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
