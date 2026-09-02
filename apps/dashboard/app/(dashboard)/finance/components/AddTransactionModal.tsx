'use client';

import { useState, useTransition } from 'react';
import { Plus, X, ArrowDownLeft, ArrowUpRight, Loader2, Check, Calendar, Tag, Wallet } from 'lucide-react';
import { recordTransaction } from '../actions';

interface Account {
    id: string;
    name: string;
    balance: number;
    currency: string;
}

interface Category {
    id: string;
    name: string;
    type: 'income' | 'expense';
}

interface AddTransactionModalProps {
    accounts: Account[];
    categories: Category[];
}

export default function AddTransactionModal({ accounts, categories }: AddTransactionModalProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [type, setType] = useState<'expense' | 'income'>('expense');
    const [amount, setAmount] = useState('');
    const [accountId, setAccountId] = useState(accounts[0]?.id || '');
    const [categoryId, setCategoryId] = useState('');
    const [description, setDescription] = useState('');
    const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

    const [isPending, startTransition] = useTransition();
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const filteredCategories = categories.filter(c => c.type === type);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage('');
        setSuccessMessage('');

        const rawAmount = parseFloat(amount.replace(/[^0-9.-]+/g, ''));
        if (!rawAmount || rawAmount <= 0) {
            setErrorMessage('Nominal harus lebih dari 0');
            return;
        }

        if (!accountId) {
            setErrorMessage('Pilih rekening / dompet terlebih dahulu');
            return;
        }

        startTransition(async () => {
            try {
                await recordTransaction({
                    type,
                    amount: rawAmount,
                    accountId,
                    categoryId: categoryId || null,
                    description: description.trim() || null,
                    transactionDate: date ? new Date(date).toISOString() : undefined
                });

                setSuccessMessage('Transaksi berhasil dicatat!');
                setTimeout(() => {
                    setIsOpen(false);
                    setAmount('');
                    setDescription('');
                    setCategoryId('');
                    setSuccessMessage('');
                }, 1000);
            } catch (err: any) {
                setErrorMessage(err?.message || 'Gagal mencatat transaksi');
            }
        });
    };

    return (
        <>
            {/* Tombol Pemicu di Header */}
            <button
                onClick={() => setIsOpen(true)}
                className="w-10 h-10 rounded-full bg-primary hover:bg-primary-container text-on-primary flex items-center justify-center transition-all shadow-[0_4px_16px_rgba(56,74,216,0.3)] active:scale-95"
                title="Catat Transaksi Manual"
            >
                <Plus className="w-5 h-5" />
            </button>

            {/* Modal Dialog */}
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
                    <div className="bg-surface w-full max-w-lg rounded-t-[28px] sm:rounded-[28px] p-6 pb-10 sm:pb-6 shadow-2xl max-h-[90vh] overflow-y-auto border border-surface-variant">
                        {/* Header Modal */}
                        <div className="flex justify-between items-center mb-5">
                            <div>
                                <h2 className="text-xl font-extrabold text-on-surface">Catat Transaksi</h2>
                                <p className="text-xs text-secondary mt-0.5">Input manual pengeluaran atau pemasukan</p>
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-secondary hover:text-on-surface"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                            {/* Toggle Tipe: Pengeluaran vs Pemasukan */}
                            <div className="flex bg-surface-container p-1 rounded-2xl">
                                <button
                                    type="button"
                                    onClick={() => { setType('expense'); setCategoryId(''); }}
                                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${type === 'expense' ? 'bg-peach-bg text-peach-fg shadow-sm' : 'text-secondary hover:text-on-surface'}`}
                                >
                                    <ArrowUpRight className="w-4 h-4" /> Pengeluaran
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setType('income'); setCategoryId(''); }}
                                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${type === 'income' ? 'bg-mint-bg text-mint-fg shadow-sm' : 'text-secondary hover:text-on-surface'}`}
                                >
                                    <ArrowDownLeft className="w-4 h-4" /> Pemasukan
                                </button>
                            </div>

                            {/* Nominal Transaksi */}
                            <div>
                                <label className="text-xs font-bold text-secondary mb-1.5 block">Nominal (Rp) *</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-secondary text-sm">Rp</span>
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        step="any"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        placeholder="50.000"
                                        className="w-full bg-surface-container border border-surface-variant rounded-xl pl-12 pr-4 py-3 text-on-surface text-base font-extrabold focus:outline-none focus:border-primary tabular-nums"
                                    />
                                </div>
                            </div>

                            {/* Pilih Rekening / Dompet */}
                            <div>
                                <label className="text-xs font-bold text-secondary mb-1.5 flex items-center gap-1.5">
                                    <Wallet className="w-3.5 h-3.5 text-primary" /> Sumber Rekening / Dompet *
                                </label>
                                <select
                                    required
                                    value={accountId}
                                    onChange={(e) => setAccountId(e.target.value)}
                                    className="w-full bg-surface-container border border-surface-variant rounded-xl px-4 py-3 text-on-surface text-sm font-semibold focus:outline-none focus:border-primary"
                                >
                                    {accounts.map(acc => (
                                        <option key={acc.id} value={acc.id}>
                                            {acc.name} — (Saldo: Rp{Number(acc.balance).toLocaleString('id-ID')})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Pilih Kategori */}
                            <div>
                                <label className="text-xs font-bold text-secondary mb-1.5 flex items-center gap-1.5">
                                    <Tag className="w-3.5 h-3.5 text-primary" /> Kategori (Opsional)
                                </label>
                                <select
                                    value={categoryId}
                                    onChange={(e) => setCategoryId(e.target.value)}
                                    className="w-full bg-surface-container border border-surface-variant rounded-xl px-4 py-3 text-on-surface text-sm font-semibold focus:outline-none focus:border-primary"
                                >
                                    <option value="">-- Tanpa Kategori / Lainnya --</option>
                                    {filteredCategories.map(cat => (
                                        <option key={cat.id} value={cat.id}>
                                            {cat.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Deskripsi Catatan */}
                            <div>
                                <label className="text-xs font-bold text-secondary mb-1.5 block">Catatan / Deskripsi</label>
                                <input
                                    type="text"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Contoh: Beli boba, Makan siang, Bayar internet"
                                    className="w-full bg-surface-container border border-surface-variant rounded-xl px-4 py-3 text-on-surface text-sm focus:outline-none focus:border-primary"
                                />
                            </div>

                            {/* Tanggal Transaksi */}
                            <div>
                                <label className="text-xs font-bold text-secondary mb-1.5 flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5 text-primary" /> Tanggal Transaksi
                                </label>
                                <input
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
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
                                    {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> Catat Transaksi</>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
