'use client';

import { useState, useEffect, useMemo, useTransition } from 'react';
import { Plus, X, Loader2, Check, BookOpen, Clock, AlertCircle, Sparkles, Calendar } from 'lucide-react';
import { createCourseSchedule } from '../schedule-actions';

const DAYS = [
    { id: 1, name: 'Senin' },
    { id: 2, name: 'Selasa' },
    { id: 3, name: 'Rabu' },
    { id: 4, name: 'Kamis' },
    { id: 5, name: 'Jumat' },
    { id: 6, name: 'Sabtu' },
    { id: 0, name: 'Minggu' }
];

const UT_METHODS = [
    '📖 Baca BMP Mandiri (Buku Modul)',
    '💻 Tuweb (Tutorial Webinar)',
    '💬 Diskusi Tuton (LMS UT)',
    '📱 Ruang Baca Virtual (RBV)',
    '📝 Latihan Kuis / Tugas Mandiri'
];

interface ModuleItem {
    id: string;
    subject_name: string;
    module_title: string;
    kb_title: string;
    is_completed?: boolean;
}

interface AddCourseScheduleModalProps {
    defaultSubject?: string;
    availableModules?: ModuleItem[];
    existingSubjects?: string[];
    triggerButton?: React.ReactNode;
}

export default function AddCourseScheduleModal({
    defaultSubject = '',
    availableModules = [],
    existingSubjects: propExistingSubjects = [],
    triggerButton
}: AddCourseScheduleModalProps) {
    const [isOpen, setIsOpen] = useState(false);

    // Ambil daftar unik mata kuliah dari prop dan modul yang sudah ada
    const existingSubjects = useMemo(() => {
        const set = new Set<string>();
        propExistingSubjects.forEach((s) => s && set.add(s.trim()));
        availableModules.forEach((m) => m.subject_name && set.add(m.subject_name.trim()));
        return Array.from(set);
    }, [propExistingSubjects, availableModules]);

    const [subjectName, setSubjectName] = useState(defaultSubject || existingSubjects[0] || '');
    const [isCustomSubject, setIsCustomSubject] = useState(existingSubjects.length === 0);

    // Hari Belajar Rutin (Default: Hari ini atau Senin)
    const [dayOfWeek, setDayOfWeek] = useState<number>(() => {
        const d = new Date().getDay();
        return d === 0 ? 0 : d; // 0 = Minggu
    });

    // Jam Belajar
    const [startTime, setStartTime] = useState('19:30');
    const [endTime, setEndTime] = useState('21:00');
    const [studyMethod, setStudyMethod] = useState(UT_METHODS[0]);
    const [tutor, setTutor] = useState('');

    const [isPending, startTransition] = useTransition();
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    // Sinkronisasi state saat modal dibuka
    useEffect(() => {
        if (isOpen) {
            setErrorMessage('');
            setSuccessMessage('');

            const set = new Set<string>();
            propExistingSubjects.forEach((s) => s && set.add(s.trim()));
            availableModules.forEach((m) => m.subject_name && set.add(m.subject_name.trim()));
            const subjects = Array.from(set);

            const initialSubject = defaultSubject || subjects[0] || '';
            setSubjectName(initialSubject);
            setIsCustomSubject(subjects.length === 0);

            const d = new Date().getDay();
            setDayOfWeek(d);
        }
    }, [isOpen, defaultSubject, availableModules, propExistingSubjects]);

    // Quick duration handler (tambah durasi ke jam selesai)
    const setQuickDuration = (minutes: number) => {
        const [hours, mins] = startTime.split(':').map(Number);
        const startTotalMinutes = hours * 60 + mins;
        const endTotalMinutes = (startTotalMinutes + minutes) % (24 * 60);

        const endHours = String(Math.floor(endTotalMinutes / 60)).padStart(2, '0');
        const endMins = String(endTotalMinutes % 60).padStart(2, '0');
        setEndTime(`${endHours}:${endMins}`);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage('');
        setSuccessMessage('');

        if (!subjectName.trim()) {
            setErrorMessage('Nama mata kuliah harus diisi');
            return;
        }

        if (startTime >= endTime) {
            setErrorMessage('Jam selesai harus lebih akhir dari jam mulai');
            return;
        }

        startTransition(async () => {
            try {
                await createCourseSchedule({
                    subjectName: subjectName.trim(),
                    dayOfWeek,
                    startTime,
                    endTime,
                    room: studyMethod,
                    lecturer: tutor.trim() || null
                });

                setSuccessMessage('Jadwal mata kuliah berhasil ditambahkan!');
                setTimeout(() => {
                    setIsOpen(false);
                    setSuccessMessage('');
                }, 800);
            } catch (err: any) {
                setErrorMessage(err?.message || 'Gagal menyimpan jadwal');
            }
        });
    };

    return (
        <>
            {triggerButton ? (
                <div onClick={() => setIsOpen(true)} className="cursor-pointer">
                    {triggerButton}
                </div>
            ) : (
                <button
                    onClick={() => setIsOpen(true)}
                    className="px-3 py-1.5 rounded-full bg-primary text-white text-xs font-bold flex items-center gap-1.5 shadow-sm hover:opacity-90 active:scale-95 transition-all"
                >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Matkul</span>
                </button>
            )}

            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
                    <div className="bg-surface w-full max-w-lg rounded-t-[28px] sm:rounded-[28px] p-6 pb-28 sm:pb-6 shadow-2xl max-h-[88dvh] overflow-y-auto border border-surface-variant flex flex-col">
                        {/* Header Modal */}
                        <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                                    <BookOpen className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-base font-extrabold text-on-surface">
                                        Tambah Mata Kuliah
                                    </h3>
                                    <p className="text-xs text-secondary">
                                        Atur hari & jam belajar rutin mingguan
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-secondary hover:text-on-surface transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Error & Success Feedback */}
                        {errorMessage && (
                            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                <span>{errorMessage}</span>
                            </div>
                        )}

                        {successMessage && (
                            <div className="mb-4 p-3 rounded-xl bg-mint-bg border border-mint-border text-mint-fg text-xs font-bold flex items-center gap-2">
                                <Check className="w-4 h-4 flex-shrink-0" />
                                <span>{successMessage}</span>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* 1. Nama Mata Kuliah */}
                            <div>
                                <label className="block text-xs font-bold text-secondary mb-1">
                                    Nama Mata Kuliah <span className="text-red-500">*</span>
                                </label>

                                {existingSubjects.length > 0 && (
                                    <div className="flex gap-2 mb-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsCustomSubject(false);
                                                if (existingSubjects.length > 0) {
                                                    setSubjectName(existingSubjects[0]);
                                                }
                                            }}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                                                !isCustomSubject
                                                    ? 'bg-primary text-white border-primary'
                                                    : 'bg-surface-container text-secondary border-surface-variant'
                                            }`}
                                        >
                                            Pilih Terdaftar
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsCustomSubject(true);
                                                setSubjectName('');
                                            }}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                                                isCustomSubject
                                                    ? 'bg-primary text-white border-primary'
                                                    : 'bg-surface-container text-secondary border-surface-variant'
                                            }`}
                                        >
                                            Ketik Baru
                                        </button>
                                    </div>
                                )}

                                {!isCustomSubject && existingSubjects.length > 0 ? (
                                    <select
                                        value={subjectName}
                                        onChange={(e) => setSubjectName(e.target.value)}
                                        className="w-full px-3 py-2 text-xs bg-surface-container border border-surface-variant rounded-xl font-bold text-on-surface outline-none focus:ring-2 focus:ring-primary/40"
                                    >
                                        {existingSubjects.map((sub) => (
                                            <option key={sub} value={sub}>
                                                {sub}
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        type="text"
                                        value={subjectName}
                                        onChange={(e) => setSubjectName(e.target.value)}
                                        placeholder="Contoh: Sistem Operasi, Pemrograman Web"
                                        className="w-full px-3 py-2 text-xs bg-surface-container border border-surface-variant rounded-xl font-bold text-on-surface outline-none focus:ring-2 focus:ring-primary/40 placeholder:font-normal"
                                    />
                                )}
                            </div>

                            {/* 2. Hari Belajar Rutin Mingguan */}
                            <div>
                                <label className="block text-xs font-bold text-secondary mb-1.5">
                                    Hari Belajar Rutin <span className="text-red-500">*</span>
                                </label>
                                <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                                    {DAYS.map((day) => {
                                        const isSelected = dayOfWeek === day.id;
                                        return (
                                            <button
                                                key={day.id}
                                                type="button"
                                                onClick={() => setDayOfWeek(day.id)}
                                                className={`py-2 px-1 rounded-xl text-xs font-bold transition-all text-center border ${
                                                    isSelected
                                                        ? 'bg-primary text-white border-primary shadow-xs ring-2 ring-primary/20'
                                                        : 'bg-surface-container text-secondary border-surface-variant hover:border-primary/40 hover:text-on-surface'
                                                }`}
                                            >
                                                {day.name}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* 3. Jam Belajar (Mulai - Selesai) + Presets Cepat */}
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="text-xs font-bold text-secondary flex items-center gap-1">
                                        <Clock className="w-3.5 h-3.5 text-primary" /> Jam Belajar Rutin <span className="text-red-500">*</span>
                                    </label>
                                    <div className="flex items-center gap-1 text-[10px] font-bold text-secondary">
                                        <span>Durasi:</span>
                                        <button
                                            type="button"
                                            onClick={() => setQuickDuration(60)}
                                            className="px-1.5 py-0.5 rounded bg-surface-container hover:bg-surface-container-high border border-surface-variant hover:text-primary transition-colors"
                                        >
                                            1 Jam
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setQuickDuration(90)}
                                            className="px-1.5 py-0.5 rounded bg-surface-container hover:bg-surface-container-high border border-surface-variant hover:text-primary transition-colors"
                                        >
                                            1.5 Jam
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setQuickDuration(120)}
                                            className="px-1.5 py-0.5 rounded bg-surface-container hover:bg-surface-container-high border border-surface-variant hover:text-primary transition-colors"
                                        >
                                            2 Jam
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <span className="text-[10px] font-semibold text-secondary block mb-0.5">Jam Mulai</span>
                                        <input
                                            type="time"
                                            value={startTime}
                                            onChange={(e) => setStartTime(e.target.value)}
                                            className="w-full px-3 py-2 text-xs bg-surface-container border border-surface-variant rounded-xl font-bold text-on-surface outline-none focus:ring-2 focus:ring-primary/40"
                                        />
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-semibold text-secondary block mb-0.5">Jam Selesai</span>
                                        <input
                                            type="time"
                                            value={endTime}
                                            onChange={(e) => setEndTime(e.target.value)}
                                            className="w-full px-3 py-2 text-xs bg-surface-container border border-surface-variant rounded-xl font-bold text-on-surface outline-none focus:ring-2 focus:ring-primary/40"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* 4. Metode Belajar UT */}
                            <div>
                                <label className="block text-xs font-bold text-secondary mb-1">
                                    Metode Belajar UT
                                </label>
                                <select
                                    value={studyMethod}
                                    onChange={(e) => setStudyMethod(e.target.value)}
                                    className="w-full px-3 py-2 text-xs bg-surface-container border border-surface-variant rounded-xl font-bold text-on-surface outline-none focus:ring-2 focus:ring-primary/40"
                                >
                                    {UT_METHODS.map((m) => (
                                        <option key={m} value={m}>
                                            {m}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* 5. Tutor / Dosen (Opsional) */}
                            <div>
                                <label className="block text-xs font-bold text-secondary mb-1">
                                    Tutor / Dosen (Opsional)
                                </label>
                                <input
                                    type="text"
                                    value={tutor}
                                    onChange={(e) => setTutor(e.target.value)}
                                    placeholder="Contoh: Pak Budi, S.Kom., M.T."
                                    className="w-full px-3 py-2 text-xs bg-surface-container border border-surface-variant rounded-xl font-medium text-on-surface outline-none focus:ring-2 focus:ring-primary/40 placeholder:font-normal"
                                />
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-2 pt-3">
                                <button
                                    type="button"
                                    onClick={() => setIsOpen(false)}
                                    className="flex-1 py-2.5 rounded-xl bg-surface-container text-secondary text-xs font-bold hover:text-on-surface transition-colors"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={isPending}
                                    className="flex-1 py-2.5 rounded-xl bg-primary text-white text-xs font-bold hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm"
                                >
                                    {isPending ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Check className="w-4 h-4" />
                                    )}
                                    <span>Simpan Jadwal</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
