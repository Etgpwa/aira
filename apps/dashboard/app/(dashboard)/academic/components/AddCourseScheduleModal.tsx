'use client';

import { useState, useEffect, useMemo, useTransition } from 'react';
import { Plus, X, Loader2, Check, BookOpen, Clock, AlertCircle, Sparkles, CheckCircle2 } from 'lucide-react';
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
    triggerButton?: React.ReactNode;
}

export default function AddCourseScheduleModal({
    defaultSubject = '',
    availableModules = [],
    triggerButton
}: AddCourseScheduleModalProps) {
    const [isOpen, setIsOpen] = useState(false);

    // Ambil daftar unik mata kuliah dari modul yang sudah ada
    const existingSubjects = useMemo(() => {
        return Array.from(
            new Set(availableModules.map((m) => m.subject_name?.trim()).filter(Boolean))
        );
    }, [availableModules]);

    const [subjectName, setSubjectName] = useState(defaultSubject || existingSubjects[0] || '');
    const [isCustomSubject, setIsCustomSubject] = useState(existingSubjects.length === 0);

    // State Target Materi / Modul
    const [selectedModuleId, setSelectedModuleId] = useState<string>('');
    const [isCustomMaterial, setIsCustomMaterial] = useState<boolean>(true);
    const [customMaterialText, setCustomMaterialText] = useState('');

    // State Hari, Jam, Metode, Tutor
    const [dayOfWeek, setDayOfWeek] = useState<number>(1);
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

            const subjects = Array.from(
                new Set(availableModules.map((m) => m.subject_name?.trim()).filter(Boolean))
            );

            const initialSubject = defaultSubject || subjects[0] || '';
            setSubjectName(initialSubject);
            setIsCustomSubject(subjects.length === 0);

            const filteredMods = availableModules.filter(
                (m) => m.subject_name?.trim().toLowerCase() === initialSubject.trim().toLowerCase()
            );

            if (filteredMods.length > 0) {
                setSelectedModuleId(filteredMods[0].id);
                setIsCustomMaterial(false);
            } else {
                setSelectedModuleId('');
                setIsCustomMaterial(true);
            }
        }
    }, [isOpen, defaultSubject, availableModules]);

    // Modul yang relevan dengan mata kuliah yang sedang dipilih
    const currentSubjectModules = useMemo(() => {
        if (!subjectName) return [];
        return availableModules.filter(
            (m) => m.subject_name?.trim().toLowerCase() === subjectName.trim().toLowerCase()
        );
    }, [availableModules, subjectName]);

    // Handle saat ganti mata kuliah dari dropdown
    const handleSubjectChange = (newSubject: string) => {
        setSubjectName(newSubject);
        const filtered = availableModules.filter(
            (m) => m.subject_name?.trim().toLowerCase() === newSubject.trim().toLowerCase()
        );
        if (filtered.length > 0) {
            setSelectedModuleId(filtered[0].id);
            setIsCustomMaterial(false);
        } else {
            setSelectedModuleId('');
            setIsCustomMaterial(true);
        }
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

        // Tentukan target material dan moduleId
        let finalTargetMaterial = '';
        let finalModuleId: string | null = null;

        if (!isCustomMaterial && selectedModuleId) {
            const foundMod = currentSubjectModules.find((m) => m.id === selectedModuleId);
            if (foundMod) {
                finalTargetMaterial = `${foundMod.module_title} • ${foundMod.kb_title}`;
                finalModuleId = foundMod.id;
            }
        } else if (customMaterialText.trim()) {
            finalTargetMaterial = customMaterialText.trim();
        }

        startTransition(async () => {
            try {
                await createCourseSchedule({
                    subjectName: subjectName.trim(),
                    dayOfWeek,
                    startTime,
                    endTime,
                    room: studyMethod.trim() || null,
                    lecturer: tutor.trim() || null,
                    targetMaterial: finalTargetMaterial || null,
                    moduleId: finalModuleId
                });

                setSuccessMessage('Jadwal belajar mandiri berhasil disimpan!');
                setTimeout(() => {
                    setIsOpen(false);
                    setSuccessMessage('');
                    setCustomMaterialText('');
                }, 1000);
            } catch (err: any) {
                setErrorMessage(err?.message || 'Gagal menyimpan jadwal');
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
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-full text-xs font-bold transition-all active:scale-95"
                    title="Tambah Jadwal Belajar"
                >
                    <Plus className="w-3.5 h-3.5" /> Jadwal Belajar Mandiri
                </button>
            )}

            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
                    <div className="bg-surface w-full max-w-lg rounded-t-[28px] sm:rounded-[28px] p-6 pb-28 sm:pb-6 shadow-2xl max-h-[88dvh] overflow-y-auto border border-surface-variant flex flex-col">
                        {/* Header Modal */}
                        <div className="flex justify-between items-center mb-5">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                                    <BookOpen className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-extrabold text-on-surface">Jadwal Belajar Mandiri</h2>
                                    <p className="text-xs text-secondary mt-0.5">Tentukan hari, jam, & modul yang ingin kamu pelajari</p>
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
                            {/* 1. Mata Kuliah */}
                            <div>
                                <div className="flex justify-between items-center mb-1.5">
                                    <label className="text-xs font-bold text-secondary">Mata Kuliah *</label>
                                    {existingSubjects.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const nextState = !isCustomSubject;
                                                setIsCustomSubject(nextState);
                                                if (nextState) {
                                                    setSubjectName('');
                                                    setIsCustomMaterial(true);
                                                } else {
                                                    handleSubjectChange(existingSubjects[0] || '');
                                                }
                                            }}
                                            className="text-[11px] font-bold text-primary hover:underline"
                                        >
                                            {isCustomSubject ? 'Pilih dari Modul' : '+ Ketik Matkul Baru'}
                                        </button>
                                    )}
                                </div>

                                {!isCustomSubject && existingSubjects.length > 0 ? (
                                    <select
                                        value={subjectName}
                                        onChange={(e) => handleSubjectChange(e.target.value)}
                                        className="w-full bg-surface-container border border-surface-variant rounded-xl px-4 py-3 text-on-surface text-sm font-semibold focus:outline-none focus:border-primary"
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
                                        required
                                        value={subjectName}
                                        onChange={(e) => handleSubjectChange(e.target.value)}
                                        placeholder="Contoh: Statistika Ekonomi, Bahasa Indonesia"
                                        className="w-full bg-surface-container border border-surface-variant rounded-xl px-4 py-3 text-on-surface text-sm font-semibold focus:outline-none focus:border-primary"
                                    />
                                )}
                            </div>

                            {/* 2. Target Materi / Modul Spesifik Hari Itu */}
                            <div className="bg-surface-container-low border border-surface-variant rounded-2xl p-4">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-xs font-bold text-primary flex items-center gap-1.5">
                                        <Sparkles className="w-3.5 h-3.5" /> Target Materi yang Dipelajari
                                    </label>
                                    {currentSubjectModules.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => setIsCustomMaterial(!isCustomMaterial)}
                                            className="text-[10px] font-bold text-primary hover:underline"
                                        >
                                            {isCustomMaterial ? 'Pilih Modul Terdaftar' : 'Ketik Manual'}
                                        </button>
                                    )}
                                </div>

                                {!isCustomMaterial && currentSubjectModules.length > 0 ? (
                                    <div>
                                        <select
                                            value={selectedModuleId}
                                            onChange={(e) => setSelectedModuleId(e.target.value)}
                                            className="w-full bg-surface border border-surface-variant rounded-xl px-3.5 py-2.5 text-on-surface text-xs font-semibold focus:outline-none focus:border-primary"
                                        >
                                            {currentSubjectModules.map((m) => (
                                                <option key={m.id} value={m.id}>
                                                    {m.module_title} • {m.kb_title} {m.is_completed ? '✅ (Selesai)' : ''}
                                                </option>
                                            ))}
                                        </select>
                                        <p className="text-[10px] text-secondary mt-1.5">
                                            Jadwal ini akan terhubung langsung ke materi bacaan & simulasi kuis di tab Kuliah.
                                        </p>
                                    </div>
                                ) : (
                                    <div>
                                        <input
                                            type="text"
                                            value={customMaterialText}
                                            onChange={(e) => setCustomMaterialText(e.target.value)}
                                            placeholder="Contoh: Baca BMP Modul 2 hal 2.1-2.30, atau Kerjakan Tugas 1"
                                            className="w-full bg-surface border border-surface-variant rounded-xl px-3.5 py-2.5 text-on-surface text-xs font-semibold focus:outline-none focus:border-primary placeholder:text-outline"
                                        />
                                        <p className="text-[10px] text-secondary mt-1.5">
                                            Tuliskan target belajar mandirimu untuk hari ini secara fleksibel.
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* 3. Hari & Jam Belajar Mandiri */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-secondary mb-1.5 block">Hari Belajar</label>
                                    <select
                                        value={dayOfWeek}
                                        onChange={(e) => setDayOfWeek(Number(e.target.value))}
                                        className="w-full bg-surface-container border border-surface-variant rounded-xl px-3.5 py-3 text-on-surface text-sm font-semibold focus:outline-none focus:border-primary"
                                    >
                                        {DAYS.map((d) => (
                                            <option key={d.id} value={d.id}>
                                                {d.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-secondary mb-1.5 flex items-center gap-1">
                                        <Clock className="w-3 h-3 text-primary" /> Jam Mulai *
                                    </label>
                                    <input
                                        type="time"
                                        required
                                        value={startTime}
                                        onChange={(e) => setStartTime(e.target.value)}
                                        className="w-full bg-surface-container border border-surface-variant rounded-xl px-3 py-2.5 text-on-surface text-sm font-bold focus:outline-none focus:border-primary"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-secondary mb-1.5 flex items-center gap-1">
                                        <Clock className="w-3 h-3 text-primary" /> Jam Selesai *
                                    </label>
                                    <input
                                        type="time"
                                        required
                                        value={endTime}
                                        onChange={(e) => setEndTime(e.target.value)}
                                        className="w-full bg-surface-container border border-surface-variant rounded-xl px-3 py-2.5 text-on-surface text-sm font-bold focus:outline-none focus:border-primary"
                                    />
                                </div>
                            </div>

                            {/* 4. Metode Belajar Khas UT (Pengganti Ruangan) */}
                            <div>
                                <label className="text-xs font-bold text-secondary mb-1.5 block">
                                    Metode / Media Belajar Mandiri
                                </label>
                                <select
                                    value={studyMethod}
                                    onChange={(e) => setStudyMethod(e.target.value)}
                                    className="w-full bg-surface-container border border-surface-variant rounded-xl px-3.5 py-2.5 text-on-surface text-xs font-semibold focus:outline-none focus:border-primary"
                                >
                                    {UT_METHODS.map((m) => (
                                        <option key={m} value={m}>
                                            {m}
                                        </option>
                                    ))}
                                    <option value="Lainnya">Lainnya / Sesi Kelas</option>
                                </select>
                            </div>

                            {/* 5. Tutor / Pengampu (Opsional) */}
                            <div>
                                <label className="text-xs font-bold text-secondary mb-1 block">
                                    Tutor / Dosen UT (Opsional)
                                </label>
                                <input
                                    type="text"
                                    value={tutor}
                                    onChange={(e) => setTutor(e.target.value)}
                                    placeholder="Contoh: Tutor Tuton / Pengampu Tuweb"
                                    className="w-full bg-surface-container border border-surface-variant rounded-xl px-3.5 py-2 text-on-surface text-xs focus:outline-none focus:border-primary"
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
                                    {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4" /> Simpan Jadwal</>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
