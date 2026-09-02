'use client';

import { useState, useTransition } from 'react';
import { X, Loader2, Check, Edit2, Calendar, Tag, AlertCircle } from 'lucide-react';
import { updateTask } from '../actions';

interface Task {
    id: string;
    title: string;
    description?: string | null;
    priority?: 'HIGH' | 'MEDIUM' | 'LOW';
    category?: string | null;
    due_date?: string | null;
    status: 'TODO' | 'IN_PROGRESS' | 'DONE';
}

interface EditTaskModalProps {
    task: Task;
    isOpen: boolean;
    onClose: () => void;
}

export default function EditTaskModal({ task, isOpen, onClose }: EditTaskModalProps) {
    const [title, setTitle] = useState(task.title);
    const [description, setDescription] = useState(task.description || '');
    const [priority, setPriority] = useState<'HIGH' | 'MEDIUM' | 'LOW'>(task.priority || 'MEDIUM');
    const [category, setCategory] = useState(task.category || '');
    const [status, setStatus] = useState<'TODO' | 'IN_PROGRESS' | 'DONE'>(task.status);
    const [dueDate, setDueDate] = useState(
        task.due_date ? new Date(task.due_date).toISOString().slice(0, 16) : ''
    );

    const [isPending, startTransition] = useTransition();
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    if (!isOpen) return null;

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
                await updateTask({
                    id: task.id,
                    title: title.trim(),
                    description: description.trim() || null,
                    priority,
                    category: category.trim() || null,
                    dueDate: dueDate || null,
                    status
                });

                setSuccessMessage('Tugas berhasil diperbarui!');
                setTimeout(() => {
                    onClose();
                    setSuccessMessage('');
                }, 1000);
            } catch (err: any) {
                setErrorMessage(err?.message || 'Gagal memperbarui tugas');
            }
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
            <div className="bg-surface w-full max-w-lg rounded-t-[28px] sm:rounded-[28px] p-6 pb-10 sm:pb-6 shadow-2xl max-h-[90vh] overflow-y-auto border border-surface-variant">
                {/* Header Modal */}
                <div className="flex justify-between items-center mb-5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                            <Edit2 className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-extrabold text-on-surface">Edit Tugas</h2>
                            <p className="text-xs text-secondary mt-0.5">Ubah rincian pekerjaan atau pindah status</p>
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
                    {/* Judul Tugas */}
                    <div>
                        <label className="text-xs font-bold text-secondary mb-1.5 block">Judul Tugas *</label>
                        <input
                            type="text"
                            required
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Contoh: Bikin laporan magang"
                            className="w-full bg-surface-container border border-surface-variant rounded-xl px-4 py-3 text-on-surface text-sm font-semibold focus:outline-none focus:border-primary"
                        />
                    </div>

                    {/* Prioritas & Status */}
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
                            <label className="text-xs font-bold text-secondary mb-1.5 block">Status</label>
                            <select
                                value={status}
                                onChange={(e) => setStatus(e.target.value as any)}
                                className="w-full bg-surface-container border border-surface-variant rounded-xl px-4 py-3 text-on-surface text-sm font-semibold focus:outline-none focus:border-primary"
                            >
                                <option value="TODO">📋 To Do</option>
                                <option value="IN_PROGRESS">⏳ In Progress</option>
                                <option value="DONE">✅ Done (Selesai)</option>
                            </select>
                        </div>
                    </div>

                    {/* Kategori & Deadline */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-bold text-secondary mb-1.5 flex items-center gap-1.5">
                                <Tag className="w-3.5 h-3.5 text-primary" /> Kategori
                            </label>
                            <input
                                type="text"
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                placeholder="Contoh: Kerja, Kuliah"
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
                        <label className="text-xs font-bold text-secondary mb-1.5 block">Catatan / Detail Progres</label>
                        <textarea
                            rows={3}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Catatan detail tugas..."
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
