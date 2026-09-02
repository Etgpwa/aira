'use client';

import { useState, useTransition } from 'react';
import { Tag, Plus, Trash2, Check, X, Loader2, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { addCategory, deleteCategory } from '../actions';

interface Category {
    id: string;
    name: string;
    type: 'income' | 'expense';
}

interface CategoriesManagerProps {
    initialCategories: Category[];
}

export default function CategoriesManager({ initialCategories }: CategoriesManagerProps) {
    const [categories, setCategories] = useState<Category[]>(initialCategories || []);
    const [selectedType, setSelectedType] = useState<'expense' | 'income'>('expense');
    const [isAdding, setIsAdding] = useState(false);
    const [newName, setNewName] = useState('');
    const [isPending, startTransition] = useTransition();

    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const filteredCategories = initialCategories.filter(c => c.type === selectedType);

    const handleAdd = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim()) return;

        setErrorMessage('');
        setSuccessMessage('');

        startTransition(async () => {
            try {
                await addCategory(newName, selectedType);
                setIsAdding(false);
                setNewName('');
                setSuccessMessage(`Kategori "${newName}" berhasil ditambahkan!`);
                setTimeout(() => setSuccessMessage(''), 3000);
            } catch (err: any) {
                setErrorMessage(err?.message || 'Gagal menambahkan kategori');
            }
        });
    };

    const handleDelete = (id: string, name: string) => {
        if (!confirm(`Hapus kategori "${name}"?`)) return;

        setErrorMessage('');
        setSuccessMessage('');

        startTransition(async () => {
            try {
                await deleteCategory(id);
                setSuccessMessage(`Kategori "${name}" berhasil dihapus.`);
                setTimeout(() => setSuccessMessage(''), 3000);
            } catch (err: any) {
                setErrorMessage(err?.message || 'Gagal menghapus kategori');
            }
        });
    };

    return (
        <div className="bg-surface-bright border border-surface-variant rounded-[24px] p-6 shadow-[0_8px_24px_rgba(24,26,42,0.04)]">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-lavender-bg flex items-center justify-center text-lavender-fg">
                        <Tag className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-on-surface">Kategori Transaksi</h2>
                        <p className="text-xs text-secondary">Kelola pengelompokan pemasukan dan pengeluaran</p>
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

            {/* Tab Tipe: Expense vs Income */}
            <div className="flex bg-surface-container p-1 rounded-2xl mb-4">
                <button
                    onClick={() => { setSelectedType('expense'); setIsAdding(false); }}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${selectedType === 'expense' ? 'bg-surface text-on-surface shadow-sm' : 'text-secondary hover:text-on-surface'}`}
                >
                    <ArrowUpRight className="w-3.5 h-3.5 text-peach-fg" /> Pengeluaran ({initialCategories.filter(c => c.type === 'expense').length})
                </button>
                <button
                    onClick={() => { setSelectedType('income'); setIsAdding(false); }}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${selectedType === 'income' ? 'bg-surface text-on-surface shadow-sm' : 'text-secondary hover:text-on-surface'}`}
                >
                    <ArrowDownLeft className="w-3.5 h-3.5 text-mint-fg" /> Pemasukan ({initialCategories.filter(c => c.type === 'income').length})
                </button>
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

            {/* Form Tambah Kategori */}
            {isAdding && (
                <form onSubmit={handleAdd} className="p-4 bg-surface-container-low rounded-2xl border border-primary/20 mb-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-primary">
                            Tambah Kategori {selectedType === 'expense' ? 'Pengeluaran' : 'Pemasukan'}
                        </p>
                        <button
                            type="button"
                            onClick={() => setIsAdding(false)}
                            className="w-6 h-6 rounded-full bg-surface-container flex items-center justify-center text-secondary"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    <div>
                        <input
                            type="text"
                            required
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder={selectedType === 'expense' ? 'Contoh: Belanja Bulanan, Langganan AI' : 'Contoh: Gaji Pokok, Freelance'}
                            className="w-full bg-surface border border-surface-variant rounded-xl px-3 py-2 text-xs font-semibold text-on-surface focus:outline-none focus:border-primary"
                        />
                    </div>

                    <div className="flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => setIsAdding(false)}
                            className="px-4 py-1.5 bg-surface-container text-secondary rounded-full text-xs font-bold"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={isPending}
                            className="px-5 py-1.5 bg-primary text-on-primary rounded-full text-xs font-bold flex items-center gap-1.5"
                        >
                            {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Check className="w-3.5 h-3.5" /> Simpan</>}
                        </button>
                    </div>
                </form>
            )}

            {/* Grid List Kategori */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {filteredCategories.map((cat) => (
                    <div
                        key={cat.id}
                        className="flex items-center justify-between p-3 bg-surface-container-low rounded-xl border border-surface-variant/40"
                    >
                        <span className="text-xs font-bold text-on-surface truncate flex-1 min-w-0 pr-2">
                            {cat.name}
                        </span>

                        <button
                            onClick={() => handleDelete(cat.id, cat.name)}
                            className="w-6 h-6 rounded-md hover:bg-red-50 text-secondary hover:text-red-500 flex items-center justify-center transition-colors flex-shrink-0"
                            title="Hapus Kategori"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                ))}

                {filteredCategories.length === 0 && (
                    <p className="text-xs text-secondary text-center py-6 col-span-2">
                        Belum ada kategori {selectedType === 'expense' ? 'pengeluaran' : 'pemasukan'}.
                    </p>
                )}
            </div>
        </div>
    );
}
