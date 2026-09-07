'use client';

import { useState, useTransition, useEffect } from 'react';
import { Plus, Loader2, X, ChevronDown, BookOpen } from 'lucide-react';
import { createModule } from '../actions';
import { useRouter } from 'next/navigation';

interface CreateModuleModalProps {
    existingSubjects?: string[];
}

export default function CreateModuleModal({ existingSubjects = [] }: CreateModuleModalProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    const [isCustomSubject, setIsCustomSubject] = useState(existingSubjects.length === 0);
    const [selectedSubject, setSelectedSubject] = useState(existingSubjects[0] || '');
    const [customSubject, setCustomSubject] = useState('');

    // Sinkronisasi saat existingSubjects berubah atau modal dibuka
    useEffect(() => {
        if (existingSubjects.length > 0) {
            if (!selectedSubject || !existingSubjects.includes(selectedSubject)) {
                setSelectedSubject(existingSubjects[0]);
            }
        } else {
            setIsCustomSubject(true);
        }
    }, [existingSubjects, isOpen]);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const finalSubject = isCustomSubject ? customSubject.trim() : selectedSubject.trim();

        if (!finalSubject) {
            alert('Nama mata kuliah wajib diisi');
            return;
        }

        formData.set('subject_name', finalSubject);

        startTransition(async () => {
            try {
                const result = await createModule(formData);
                setIsOpen(false);
                router.push(`/academic/${result.id}`);
            } catch (err) {
                console.error(err);
                alert('Gagal membuat KB, coba lagi.');
            }
        });
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="w-full flex items-center justify-center gap-2 p-4 bg-primary text-on-primary rounded-[20px] font-bold shadow-[0_8px_20px_rgba(56,74,216,0.3)] active:scale-[0.98] transition-transform"
            >
                <Plus className="w-5 h-5" /> Buat KB Baru
            </button>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
            <div className="bg-surface w-full max-w-lg rounded-t-[28px] sm:rounded-[28px] p-6 pb-10 sm:pb-6 shadow-2xl border border-surface-variant">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                            <BookOpen className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-extrabold text-on-surface">Buat KB Baru</h2>
                            <p className="text-xs text-secondary">Kontainer materi perkuliahan & bank soal</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-secondary hover:text-on-surface transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    {/* Pemilihan / Input Nama Mata Kuliah */}
                    <div>
                        <label className="text-xs font-bold text-secondary mb-1.5 block">
                            Nama Mata Kuliah <span className="text-red-500">*</span>
                        </label>

                        {existingSubjects.length > 0 && (
                            <div className="flex gap-2 mb-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsCustomSubject(false);
                                        if (!selectedSubject && existingSubjects.length > 0) {
                                            setSelectedSubject(existingSubjects[0]);
                                        }
                                    }}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                                        !isCustomSubject
                                            ? 'bg-primary text-white border-primary shadow-xs'
                                            : 'bg-surface-container text-secondary border-surface-variant hover:bg-surface-container-high'
                                    }`}
                                >
                                    Pilih Terdaftar
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsCustomSubject(true);
                                        setCustomSubject('');
                                    }}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                                        isCustomSubject
                                            ? 'bg-primary text-white border-primary shadow-xs'
                                            : 'bg-surface-container text-secondary border-surface-variant hover:bg-surface-container-high'
                                    }`}
                                >
                                    + Matkul Baru
                                </button>
                            </div>
                        )}

                        {!isCustomSubject && existingSubjects.length > 0 ? (
                            <div className="relative">
                                <select
                                    value={selectedSubject}
                                    onChange={(e) => {
                                        if (e.target.value === '__NEW__') {
                                            setIsCustomSubject(true);
                                            setCustomSubject('');
                                        } else {
                                            setSelectedSubject(e.target.value);
                                        }
                                    }}
                                    className="w-full bg-surface-container border border-surface-variant rounded-xl px-4 py-3 text-on-surface text-sm focus:outline-none focus:border-primary appearance-none font-medium pr-10 cursor-pointer"
                                >
                                    {existingSubjects.map((s) => (
                                        <option key={s} value={s}>
                                            {s}
                                        </option>
                                    ))}
                                    <option value="__NEW__">+ Ketik Mata Kuliah Baru...</option>
                                </select>
                                <ChevronDown className="w-4 h-4 text-secondary absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                            </div>
                        ) : (
                            <div className="space-y-1.5">
                                <input
                                    required
                                    type="text"
                                    value={customSubject}
                                    onChange={(e) => setCustomSubject(e.target.value)}
                                    placeholder="Contoh: Basis Data"
                                    className="w-full bg-surface-container border border-surface-variant rounded-xl px-4 py-3 text-on-surface text-sm focus:outline-none focus:border-primary"
                                    autoFocus={existingSubjects.length > 0}
                                />
                                {existingSubjects.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsCustomSubject(false);
                                            if (!selectedSubject && existingSubjects.length > 0) {
                                                setSelectedSubject(existingSubjects[0]);
                                            }
                                        }}
                                        className="text-xs text-primary font-semibold hover:underline"
                                    >
                                        ← Kembali pilih dari daftar matkul
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="text-xs font-bold text-secondary mb-1.5 block">
                            Judul Modul <span className="text-red-500">*</span>
                        </label>
                        <input
                            required
                            name="module_title"
                            type="text"
                            placeholder="Contoh: Modul 3"
                            className="w-full bg-surface-container border border-surface-variant rounded-xl px-4 py-3 text-on-surface text-sm focus:outline-none focus:border-primary"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-secondary mb-1.5 block">
                            Judul Kegiatan Belajar (KB) <span className="text-red-500">*</span>
                        </label>
                        <input
                            required
                            name="kb_title"
                            type="text"
                            placeholder="Contoh: KB 1 - Normalisasi Database"
                            className="w-full bg-surface-container border border-surface-variant rounded-xl px-4 py-3 text-on-surface text-sm focus:outline-none focus:border-primary"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isPending}
                        className="w-full bg-primary text-on-primary py-3.5 rounded-full font-bold mt-2 active:scale-[0.98] transition-transform flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(56,74,216,0.25)] disabled:opacity-50"
                    >
                        {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Plus className="w-5 h-5" /> Buat KB</>}
                    </button>
                </form>
            </div>
        </div>
    );
}
