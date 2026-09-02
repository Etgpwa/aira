'use client';

import { useState, useTransition } from 'react';
import { Plus, Loader2, X } from 'lucide-react';
import { createModule } from '../actions';
import { useRouter } from 'next/navigation';

export default function CreateModuleModal() {
    const [isOpen, setIsOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);

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
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-surface w-full max-w-lg rounded-t-[28px] p-6 pb-10 shadow-xl">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-extrabold text-on-surface">Buat KB Baru</h2>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-secondary"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div>
                        <label className="text-xs font-bold text-secondary mb-1.5 block">Nama Mata Kuliah *</label>
                        <input
                            required
                            name="subject_name"
                            type="text"
                            placeholder="Contoh: Basis Data"
                            className="w-full bg-surface-container border border-surface-variant rounded-xl px-4 py-3 text-on-surface text-sm focus:outline-none focus:border-primary"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-secondary mb-1.5 block">Judul Modul *</label>
                        <input
                            required
                            name="module_title"
                            type="text"
                            placeholder="Contoh: Modul 3"
                            className="w-full bg-surface-container border border-surface-variant rounded-xl px-4 py-3 text-on-surface text-sm focus:outline-none focus:border-primary"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-secondary mb-1.5 block">Judul Kegiatan Belajar (KB) *</label>
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
                        className="w-full bg-primary text-on-primary py-3.5 rounded-full font-bold mt-2 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
                    >
                        {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Plus className="w-5 h-5" /> Buat KB</>}
                    </button>
                </form>
            </div>
        </div>
    );
}
