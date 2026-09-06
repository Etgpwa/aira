'use client';

import { useState, useTransition } from 'react';
import { Pencil, Trash2, X, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { updateModule, deleteModule } from '../../actions';
import { useRouter } from 'next/navigation';

interface ModuleHeaderActionsProps {
    moduleId: string;
    initialSubject: string;
    initialModuleTitle: string;
    initialKbTitle: string;
    questionCount: number;
}

export default function ModuleHeaderActions({
    moduleId,
    initialSubject,
    initialModuleTitle,
    initialKbTitle,
    questionCount
}: ModuleHeaderActionsProps) {
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);

    const [subjectName, setSubjectName] = useState(initialSubject);
    const [moduleTitle, setModuleTitle] = useState(initialModuleTitle);
    const [kbTitle, setKbTitle] = useState(initialKbTitle);

    const [isPending, startTransition] = useTransition();
    const [errorMessage, setErrorMessage] = useState('');
    const router = useRouter();

    const handleUpdate = (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage('');

        if (!subjectName.trim() || !moduleTitle.trim() || !kbTitle.trim()) {
            setErrorMessage('Semua bidang (Mata Kuliah, Modul, dan KB) wajib diisi.');
            return;
        }

        startTransition(async () => {
            try {
                await updateModule(moduleId, {
                    subject_name: subjectName,
                    module_title: moduleTitle,
                    kb_title: kbTitle
                });
                setIsEditOpen(false);
                router.refresh();
            } catch (err: any) {
                setErrorMessage(err?.message || 'Gagal menyimpan perubahan.');
            }
        });
    };

    const handleDelete = () => {
        setErrorMessage('');
        startTransition(async () => {
            try {
                await deleteModule(moduleId);
                setIsDeleteOpen(false);
                router.push('/academic');
            } catch (err: any) {
                setErrorMessage(err?.message || 'Gagal menghapus KB.');
            }
        });
    };

    return (
        <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Tombol Edit */}
            <button
                onClick={() => {
                    setSubjectName(initialSubject);
                    setModuleTitle(initialModuleTitle);
                    setKbTitle(initialKbTitle);
                    setErrorMessage('');
                    setIsEditOpen(true);
                }}
                className="w-8 h-8 rounded-full bg-surface-container hover:bg-surface-variant flex items-center justify-center text-secondary hover:text-primary transition-colors"
                title="Edit Nama KB / Modul"
            >
                <Pencil className="w-4 h-4" />
            </button>

            {/* Tombol Hapus */}
            <button
                onClick={() => {
                    setErrorMessage('');
                    setIsDeleteOpen(true);
                }}
                className="w-8 h-8 rounded-full bg-surface-container hover:bg-red-50 flex items-center justify-center text-secondary hover:text-red-600 transition-colors"
                title="Hapus KB"
            >
                <Trash2 className="w-4 h-4" />
            </button>

            {/* Modal Edit Modul & KB */}
            {isEditOpen && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
                    <div className="bg-surface w-full max-w-md rounded-t-[28px] sm:rounded-[28px] p-6 shadow-2xl border border-surface-variant flex flex-col">
                        <div className="flex justify-between items-center mb-4 pb-2 border-b border-surface-variant">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                    <Pencil className="w-4 h-4" />
                                </div>
                                <h3 className="text-base font-bold text-on-surface">Edit Kegiatan Belajar (KB)</h3>
                            </div>
                            <button
                                onClick={() => setIsEditOpen(false)}
                                className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-secondary hover:text-on-surface"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <form onSubmit={handleUpdate} className="flex flex-col gap-3.5">
                            <div>
                                <label className="text-xs font-bold text-secondary mb-1 block">Mata Kuliah</label>
                                <input
                                    type="text"
                                    required
                                    value={subjectName}
                                    onChange={e => setSubjectName(e.target.value)}
                                    className="w-full bg-surface-container border border-surface-variant rounded-xl px-3.5 py-2.5 text-sm text-on-surface font-semibold focus:outline-none focus:border-primary"
                                    placeholder="Contoh: Statistika Ekonomi"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-secondary mb-1 block">Judul Modul</label>
                                <input
                                    type="text"
                                    required
                                    value={moduleTitle}
                                    onChange={e => setModuleTitle(e.target.value)}
                                    className="w-full bg-surface-container border border-surface-variant rounded-xl px-3.5 py-2.5 text-sm text-on-surface font-semibold focus:outline-none focus:border-primary"
                                    placeholder="Contoh: Modul 1: Konsep Dasar Statistika"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-secondary mb-1 block">Kegiatan Belajar (KB)</label>
                                <input
                                    type="text"
                                    required
                                    value={kbTitle}
                                    onChange={e => setKbTitle(e.target.value)}
                                    className="w-full bg-surface-container border border-surface-variant rounded-xl px-3.5 py-2.5 text-sm text-on-surface font-semibold focus:outline-none focus:border-primary"
                                    placeholder="Contoh: KB 1: Pengertian Data & Skala"
                                />
                            </div>

                            {errorMessage && (
                                <div className="p-3 bg-red-50 text-danger rounded-xl text-xs font-bold flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4" /> {errorMessage}
                                </div>
                            )}

                            <div className="flex gap-2.5 mt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsEditOpen(false)}
                                    className="flex-1 bg-surface-container text-secondary py-2.5 rounded-full font-bold text-sm"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={isPending}
                                    className="flex-1 bg-primary text-on-primary py-2.5 rounded-full font-bold text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-[0_4px_16px_rgba(56,74,216,0.25)]"
                                >
                                    {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4" /> Simpan</>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Konfirmasi Hapus KB */}
            {isDeleteOpen && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
                    <div className="bg-surface w-full max-w-sm rounded-[24px] p-5 shadow-2xl border border-surface-variant flex flex-col gap-3.5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0">
                                <Trash2 className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-on-surface">Hapus Kegiatan Belajar?</h3>
                                <p className="text-xs text-secondary">{initialKbTitle}</p>
                            </div>
                        </div>

                        <p className="text-xs text-secondary leading-relaxed bg-surface-container p-3 rounded-xl border border-surface-variant">
                            Tindakan ini akan menghapus modul ini beserta <strong>{questionCount} soal</strong> yang ada di dalamnya secara permanen.
                        </p>

                        {errorMessage && (
                            <div className="p-3 bg-red-50 text-danger rounded-xl text-xs font-bold flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" /> {errorMessage}
                            </div>
                        )}

                        <div className="flex gap-2.5 mt-1">
                            <button
                                type="button"
                                onClick={() => setIsDeleteOpen(false)}
                                className="flex-1 bg-surface-container text-secondary py-2.5 rounded-full font-bold text-sm"
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                onClick={handleDelete}
                                disabled={isPending}
                                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-full font-bold text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-[0_4px_16px_rgba(220,38,38,0.25)]"
                            >
                                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Hapus Permanen'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
