'use client';

import { useState, useTransition } from 'react';
import { Plus, X, Loader2, Check, Calendar, Clock, AlertCircle } from 'lucide-react';
import { createSchedule } from '../actions';

const DAYS = [
    { id: 1, name: 'Senin' },
    { id: 2, name: 'Selasa' },
    { id: 3, name: 'Rabu' },
    { id: 4, name: 'Kamis' },
    { id: 5, name: 'Jumat' },
    { id: 6, name: 'Sabtu' },
    { id: 0, name: 'Minggu' }
];

interface AddScheduleModalProps {
    defaultDayId?: number;
    triggerButton?: React.ReactNode;
}

export default function AddScheduleModal({ defaultDayId = 1, triggerButton }: AddScheduleModalProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [subject, setSubject] = useState('');
    const [dayOfWeek, setDayOfWeek] = useState<number>(defaultDayId);
    const [startTime, setStartTime] = useState('08:00');
    const [endTime, setEndTime] = useState('10:00');

    const [isPending, startTransition] = useTransition();
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage('');
        setSuccessMessage('');

        if (!subject.trim()) {
            setErrorMessage('Nama kegiatan/mata kuliah harus diisi');
            return;
        }

        if (startTime >= endTime) {
            setErrorMessage('Jam selesai harus lebih akhir dari jam mulai');
            return;
        }

        startTransition(async () => {
            try {
                await createSchedule({
                    subject: subject.trim(),
                    dayOfWeek,
                    startTime,
                    endTime
                });

                setSuccessMessage('Jadwal berhasil ditambahkan!');
                setTimeout(() => {
                    setIsOpen(false);
                    setSubject('');
                    setSuccessMessage('');
                }, 1000);
            } catch (err: any) {
                setErrorMessage(err?.message || 'Gagal menambahkan jadwal');
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
                    title="Tambah Jadwal Baru"
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
                                    <Calendar className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-extrabold text-on-surface">Tambah Jadwal Baru</h2>
                                    <p className="text-xs text-secondary mt-0.5">Atur rutinitas harian atau kelas kuliah</p>
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
                            {/* Nama Kegiatan / Mata Kuliah */}
                            <div>
                                <label className="text-xs font-bold text-secondary mb-1.5 block">Nama Kegiatan / Mata Kuliah *</label>
                                <input
                                    type="text"
                                    required
                                    value={subject}
                                    onChange={(e) => setSubject(e.target.value)}
                                    placeholder="Contoh: Algoritma & Pemrograman, Praktikum Jaringan"
                                    className="w-full bg-surface-container border border-surface-variant rounded-xl px-4 py-3 text-on-surface text-sm font-semibold focus:outline-none focus:border-primary"
                                />
                            </div>

                            {/* Pilihan Hari */}
                            <div>
                                <label className="text-xs font-bold text-secondary mb-1.5 block">Hari</label>
                                <select
                                    value={dayOfWeek}
                                    onChange={(e) => setDayOfWeek(Number(e.target.value))}
                                    className="w-full bg-surface-container border border-surface-variant rounded-xl px-4 py-3 text-on-surface text-sm font-semibold focus:outline-none focus:border-primary"
                                >
                                    {DAYS.map((d) => (
                                        <option key={d.id} value={d.id}>
                                            {d.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Jam Mulai & Jam Selesai */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-secondary mb-1.5 flex items-center gap-1.5">
                                        <Clock className="w-3.5 h-3.5 text-primary" /> Jam Mulai *
                                    </label>
                                    <input
                                        type="time"
                                        required
                                        value={startTime}
                                        onChange={(e) => setStartTime(e.target.value)}
                                        className="w-full bg-surface-container border border-surface-variant rounded-xl px-4 py-3 text-on-surface text-sm font-bold focus:outline-none focus:border-primary"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-secondary mb-1.5 flex items-center gap-1.5">
                                        <Clock className="w-3.5 h-3.5 text-primary" /> Jam Selesai *
                                    </label>
                                    <input
                                        type="time"
                                        required
                                        value={endTime}
                                        onChange={(e) => setEndTime(e.target.value)}
                                        className="w-full bg-surface-container border border-surface-variant rounded-xl px-4 py-3 text-on-surface text-sm font-bold focus:outline-none focus:border-primary"
                                    />
                                </div>
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
                                    {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> Simpan Jadwal</>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
