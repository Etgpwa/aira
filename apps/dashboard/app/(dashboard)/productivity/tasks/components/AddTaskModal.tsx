'use client';

import { useState, useTransition } from 'react';
import { Plus, X, Loader2, Check, CheckSquare, Calendar, Tag, AlertCircle } from 'lucide-react';
import { createTask } from '../actions';

interface AddTaskModalProps {
    triggerButton?: React.ReactNode;
}

export default function AddTaskModal({ triggerButton }: AddTaskModalProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState<'HIGH' | 'MEDIUM' | 'LOW'>('MEDIUM');
    const [category, setCategory] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [status, setStatus] = useState<'TODO' | 'IN_PROGRESS'>('TODO');

    const [isPending, startTransition] = useTransition();
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage('');
        setSuccessMessage('');

        if (!title.trim()) {
            setErrorMessage('Judul tugas harus diisi');
            return;
        }

        startTransition(async () => {
            try {
                await createTask({
                    title: title.trim(),
                    description: description.trim() || null,
                    priority,
                    category: category.trim() || null,
                    dueDate: dueDate || null,
                    status
                });

                setSuccessMessage('Tugas baru berhasil ditambahkan!');
                setTimeout(() => {
                    setIsOpen(false);
                    setTitle('');
                    setDescription('');
                    setCategory('');
                    setDueDate('');
                    setSuccessMessage('');
                }, 1000);
            } catch (err: any) {
                setErrorMessage(err?.message || 'Gagal menambahkan tugas');
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
                    title="Tambah Tugas Baru"
                >
                    <Plus className="w-5 h-5" />
                </button>
            )}

            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
                    <div className="bg-surface w-full max-w-lg rounded-t-[28px] sm:rounded-[28px] p-6 pb-28 sm:pb-6 shadow-2xl max-h-[88dvh] overflow-y-auto border border-surface-variant flex flex-col">
                        {/* Header Modal */}
                        <div className="flex justify-between items-center mb-5">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                                    <CheckSquare className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-extrabold text-on-surface">Tambah Tugas Baru</h2>
                                    <p className="text-xs text-secondary mt-0.5">Catat pekerjaan & tenggat waktumu</p>
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
                            {/* Judul Tugas */}
                            <div>
                                <label className="text-xs font-bold text-secondary mb-1.5 block">Judul Tugas *</label>
                                <input
                                    type="text"
                                    required
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Contoh: Bikin laporan magang, Review bab 3"
                                    className="w-full bg-surface-container border border-surface-variant rounded-xl px-4 py-3 text-on-surface text-sm font-semibold focus:outline-none focus:border-primary"
                                />
                            </div>

                            {/* Prioritas & Status Awal */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-secondary mb-1.5 block">Prioritas</label>
                                    <select
                                        value={priority}
                                        onChange={(e) => setPriority(e.target.value as any)}
                                        className="w-full bg-surface-container border border-surface-variant rounded-xl px-4 py-3 text-on-surface text-sm font-semibold focus:outline-none focus:border-primary"
                                    >
                                        <option value="HIGH">🔥 Tinggi (High)</option>
                                        <option value="MEDIUM">⚡ Sedang (Medium)</option>
                                        <option value="LOW">🌱 Rendah (Low)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-secondary mb-1.5 block">Status Awal</label>
                                    <select
                                        value={status}
                                        onChange={(e) => setStatus(e.target.value as any)}
                                        className="w-full bg-surface-container border border-surface-variant rounded-xl px-4 py-3 text-on-surface text-sm font-semibold focus:outline-none focus:border-primary"
                                    >
                                        <option value="TODO">📋 To Do</option>
                                        <option value="IN_PROGRESS">⏳ In Progress</option>
                                    </select>
                                </div>
                            </div>

                            {/* Kategori & Deadline */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-secondary mb-1.5 flex items-center gap-1.5">
                                        <Tag className="w-3.5 h-3.5 text-primary" /> Kategori (Opsional)
                                    </label>
                                    <input
                                        type="text"
                                        value={category}
                                        onChange={(e) => setCategory(e.target.value)}
                                        placeholder="Contoh: Kerja, Kuliah, Pribadi"
                                        className="w-full bg-surface-container border border-surface-variant rounded-xl px-4 py-3 text-on-surface text-sm focus:outline-none focus:border-primary"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-secondary mb-1.5 flex items-center gap-1.5">
                                        <Calendar className="w-3.5 h-3.5 text-primary" /> Tenggat Waktu
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={dueDate}
                                        onChange={(e) => setDueDate(e.target.value)}
                                        className="w-full bg-surface-container border border-surface-variant rounded-xl px-4 py-3 text-on-surface text-sm focus:outline-none focus:border-primary"
                                    />
                                </div>
                            </div>

                            {/* Deskripsi / Catatan Progres */}
                            <div>
                                <label className="text-xs font-bold text-secondary mb-1.5 block">Catatan / Detail Pekerjaan</label>
                                <textarea
                                    rows={3}
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Tulis catatan, instruksi, atau progres tugas..."
                                    className="w-full bg-surface-container border border-surface-variant rounded-xl px-4 py-3 text-on-surface text-sm focus:outline-none focus:border-primary resize-none font-medium"
                                />
                            </div>

                            {/* Pesan Feedback */}
                            {successMessage && (
                                <div className="p-3 bg-mint-bg/30 text-mint-fg rounded-xl text-xs font-bold flex items-center gap-2">
                                    <Check className="w-4 h-4" /> {successMessage}
                                </div>
                            )}
                            {errorMessage && (
                                <div className="p-3 bg-red-50 text-danger rounded-xl text-xs font-bold flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4" /> {errorMessage}
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
                                    {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> Simpan Tugas</>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
