'use client';

import { useState, useTransition } from 'react';
import { Wallet, Plus, Edit2, Trash2, Check, X, Loader2 } from 'lucide-react';
import { addBankAccount, updateBankAccount, deleteBankAccount } from '../actions';

interface Account {
    id: string;
    name: string;
    balance: number;
    currency: string;
}

interface AccountsManagerProps {
    initialAccounts: Account[];
}

export default function AccountsManager({ initialAccounts }: AccountsManagerProps) {
    const [accounts, setAccounts] = useState<Account[]>(initialAccounts || []);
    const [isPending, startTransition] = useTransition();

    // State Tambah Akun
    const [isAdding, setIsAdding] = useState(false);
    const [newName, setNewName] = useState('');
    const [newBalance, setNewBalance] = useState('');

    // State Edit Akun
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editBalance, setEditBalance] = useState('');

    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const formatRupiah = (num: number) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
    };

    const handleAdd = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim()) return;

        setErrorMessage('');
        setSuccessMessage('');

        startTransition(async () => {
            try {
                const bal = parseFloat(newBalance.replace(/[^0-9.-]+/g, '')) || 0;
                await addBankAccount(newName, bal);
                setIsAdding(false);
                setNewName('');
                setNewBalance('');
                setSuccessMessage(`Rekening "${newName}" berhasil ditambahkan!`);
                setTimeout(() => setSuccessMessage(''), 3000);
            } catch (err: any) {
                setErrorMessage(err?.message || 'Gagal menambahkan rekening');
            }
        });
    };

    const handleStartEdit = (acc: Account) => {
        setEditingId(acc.id);
        setEditName(acc.name);
        setEditBalance(String(acc.balance));
    };

    const handleSaveEdit = (id: string) => {
        if (!editName.trim()) return;

        setErrorMessage('');
        setSuccessMessage('');

        startTransition(async () => {
            try {
                const bal = parseFloat(editBalance.replace(/[^0-9.-]+/g, '')) || 0;
                await updateBankAccount(id, editName, bal);
                setEditingId(null);
                setSuccessMessage(`Rekening "${editName}" berhasil diperbarui!`);
                setTimeout(() => setSuccessMessage(''), 3000);
            } catch (err: any) {
                setErrorMessage(err?.message || 'Gagal memperbarui rekening');
            }
        });
    };

    const handleDelete = (id: string, name: string) => {
        if (!confirm(`Hapus rekening "${name}"? Semua data transaksi terkait mungkin terpengaruh.`)) return;

        setErrorMessage('');
        setSuccessMessage('');

        startTransition(async () => {
            try {
                await deleteBankAccount(id);
                setSuccessMessage(`Rekening "${name}" berhasil dihapus.`);
                setTimeout(() => setSuccessMessage(''), 3000);
            } catch (err: any) {
                setErrorMessage(err?.message || 'Gagal menghapus rekening');
            }
        });
    };

    return (
        <div className="bg-surface-bright border border-surface-variant rounded-[24px] p-6 shadow-[0_8px_24px_rgba(24,26,42,0.04)]">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-mint-bg flex items-center justify-center text-mint-fg">
                        <Wallet className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-on-surface">Rekening & Dompet</h2>
                        <p className="text-xs text-secondary">Kelola daftar bank, e-wallet, atau kas tunai</p>
                    </div>
                </div>

                {!isAdding && (
                    <button
                        onClick={() => setIsAdding(true)}
                        className="bg-primary hover:bg-primary-container text-on-primary px-3.5 py-2 rounded-full text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                    >
                        <Plus className="w-4 h-4" /> Tambah
                    </button>
                )}
            </div>

            {/* Feedback Message */}
            {successMessage && (
                <div className="p-3 bg-mint-bg/30 text-mint-fg rounded-xl text-xs font-bold flex items-center gap-2 mb-4">
                    <Check className="w-4 h-4" /> {successMessage}
                </div>
            )}
            {errorMessage && (
                <div className="p-3 bg-red-50 text-danger rounded-xl text-xs font-bold mb-4">
                    {errorMessage}
                </div>
            )}

            {/* Form Tambah Rekening */}
            {isAdding && (
                <form onSubmit={handleAdd} className="p-4 bg-surface-container-low rounded-2xl border border-primary/20 mb-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-primary flex items-center gap-1.5">
                            <Plus className="w-4 h-4" /> Tambah Rekening Baru
                        </p>
                        <button
                            type="button"
                            onClick={() => setIsAdding(false)}
                            className="w-6 h-6 rounded-full bg-surface-container flex items-center justify-center text-secondary"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="text-[11px] font-bold text-secondary mb-1 block">Nama Rekening / Dompet *</label>
                            <input
                                type="text"
                                required
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                placeholder="Contoh: BCA, OVO, Cash"
                                className="w-full bg-surface border border-surface-variant rounded-xl px-3 py-2 text-xs font-semibold text-on-surface focus:outline-none focus:border-primary"
                            />
                        </div>
                        <div>
                            <label className="text-[11px] font-bold text-secondary mb-1 block">Saldo Awal (Rp)</label>
                            <input
                                type="number"
                                value={newBalance}
                                onChange={(e) => setNewBalance(e.target.value)}
                                placeholder="0"
                                className="w-full bg-surface border border-surface-variant rounded-xl px-3 py-2 text-xs font-semibold text-on-surface focus:outline-none focus:border-primary"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 mt-1">
                        <button
                            type="button"
                            onClick={() => setIsAdding(false)}
                            className="px-4 py-2 bg-surface-container text-secondary rounded-full text-xs font-bold"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={isPending}
                            className="px-5 py-2 bg-primary text-on-primary rounded-full text-xs font-bold flex items-center gap-1.5"
                        >
                            {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Check className="w-3.5 h-3.5" /> Simpan</>}
                        </button>
                    </div>
                </form>
            )}

            {/* List Rekening */}
            <div className="flex flex-col gap-2.5">
                {initialAccounts.map((acc) => {
                    const isEditingThis = editingId === acc.id;

                    if (isEditingThis) {
                        return (
                            <div key={acc.id} className="p-3.5 bg-surface-container-low rounded-2xl border border-primary/30 flex flex-col gap-3">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <input
                                        type="text"
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        placeholder="Nama rekening"
                                        className="bg-surface border border-surface-variant rounded-xl px-3 py-1.5 text-xs font-bold text-on-surface focus:outline-none focus:border-primary"
                                    />
                                    <input
                                        type="number"
                                        value={editBalance}
                                        onChange={(e) => setEditBalance(e.target.value)}
                                        placeholder="Saldo"
                                        className="bg-surface border border-surface-variant rounded-xl px-3 py-1.5 text-xs font-bold text-on-surface focus:outline-none focus:border-primary"
                                    />
                                </div>
                                <div className="flex justify-end gap-2">
                                    <button
                                        onClick={() => setEditingId(null)}
                                        className="px-3 py-1 bg-surface-container text-secondary rounded-full text-xs font-bold"
                                    >
                                        Batal
                                    </button>
                                    <button
                                        onClick={() => handleSaveEdit(acc.id)}
                                        disabled={isPending}
                                        className="px-4 py-1 bg-primary text-on-primary rounded-full text-xs font-bold flex items-center gap-1"
                                    >
                                        {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Check className="w-3 h-3" /> Simpan</>}
                                    </button>
                                </div>
                            </div>
                        );
                    }

                    return (
                        <div key={acc.id} className="flex items-center justify-between p-3.5 bg-surface-container-low/90 hover:bg-surface-container transition-colors rounded-[16px] gap-4">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary flex-shrink-0">
                                    <Wallet className="w-5 h-5" />
                                </div>
                                <div className="min-w-0">
                                    <p className="font-bold text-on-surface text-sm truncate">{acc.name}</p>
                                    <p className="text-[11px] text-secondary font-medium">{acc.currency || 'IDR'}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 flex-shrink-0">
                                <span className="font-extrabold text-on-surface tabular-nums text-sm sm:text-base whitespace-nowrap text-right">
                                    {formatRupiah(Number(acc.balance))}
                                </span>

                                <div className="flex items-center gap-1 border-l border-surface-variant/60 pl-2">
                                    <button
                                        onClick={() => handleStartEdit(acc)}
                                        className="w-7 h-7 rounded-lg bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-secondary hover:text-primary transition-colors"
                                        title="Edit Akun"
                                    >
                                        <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(acc.id, acc.name)}
                                        className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center text-red-500 transition-colors"
                                        title="Hapus Akun"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {initialAccounts.length === 0 && (
                    <p className="text-xs text-secondary text-center py-6">
                        Belum ada rekening/dompet yang terdaftar.
                    </p>
                )}
            </div>
        </div>
    );
}
