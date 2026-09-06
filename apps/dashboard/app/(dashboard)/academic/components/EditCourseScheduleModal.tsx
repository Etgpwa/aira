'use client';

import { useState, useEffect, useMemo, useTransition } from 'react';
import { X, Loader2, Check, Edit2, Clock, Calendar, AlertCircle, Sparkles, CheckCircle2, Plus, Trash2 } from 'lucide-react';
import { updateCourseSchedule } from '../schedule-actions';

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

interface CourseSchedule {
    id: string;
    subject_name: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    room?: string | null;
    lecturer?: string | null;
    target_material?: string | null;
    module_id?: string | null;
}

interface ModuleItem {
    id: string;
    subject_name: string;
    module_title: string;
    kb_title: string;
    is_completed?: boolean;
}

interface TargetItem {
    id: string;
    isCustom: boolean;
    moduleId: string;
    customText: string;
}

interface EditCourseScheduleModalProps {
    schedule: CourseSchedule;
    availableModules?: ModuleItem[];
    isOpen: boolean;
    onClose: () => void;
}

const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
};

function parseScheduleData(
    rawText: string | null | undefined,
    fallbackDayOfWeek: number,
    availableModules: ModuleItem[],
    subjectName: string,
    existingModuleId?: string | null
) {
    let parsedDateStr = '';
    let content = (rawText || '').trim();

    // Cek apakah target_material diawali tag tanggal, contoh: [7 Sep 2026] atau [2026-09-07]
    const dateMatch = content.match(/^\[(.*?)\]\s*(.*)$/);
    if (dateMatch) {
        const datePart = dateMatch[1].trim();
        content = dateMatch[2].trim();

        const directDate = new Date(datePart);
        if (!isNaN(directDate.getTime())) {
            parsedDateStr = directDate.toLocaleDateString('en-CA');
        } else {
            const parts = datePart.split(/\s+/);
            if (parts.length === 3) {
                const day = parts[0].padStart(2, '0');
                const year = parts[2];
                const monthMap: Record<string, string> = {
                    jan: '01', feb: '02', mar: '03', apr: '04', mei: '05', jun: '06',
                    jul: '07', agu: '08', ags: '08', sep: '09', okt: '10', nov: '11', des: '12'
                };
                const mPrefix = parts[1].toLowerCase().slice(0, 3);
                if (monthMap[mPrefix]) {
                    parsedDateStr = `${year}-${monthMap[mPrefix]}-${day}`;
                }
            }
        }
    }

    // Jika tidak ditemukan format tanggal, estimasikan tanggal berdasarkan hari minggu ini
    if (!parsedDateStr) {
        const now = new Date();
        const curDay = now.getDay();
        let diff = fallbackDayOfWeek - curDay;
        const targetDate = new Date(now);
        targetDate.setDate(targetDate.getDate() + diff);
        parsedDateStr = targetDate.toLocaleDateString('en-CA');
    }

    const subMods = availableModules.filter(
        (m) => m.subject_name?.trim().toLowerCase() === subjectName.trim().toLowerCase()
    );

    const targets: TargetItem[] = [];

    if (content) {
        // Pisahkan target berdasarkan koma
        const items = content.split(/,\s*(?=[A-Za-z0-9])/).filter(Boolean);
        items.forEach((item) => {
            const trimmed = item.trim();
            const matchingMod = subMods.find(
                (m) =>
                    `${m.module_title} • ${m.kb_title}`.toLowerCase() === trimmed.toLowerCase() ||
                    trimmed.toLowerCase().includes(m.kb_title.toLowerCase())
            );
            if (matchingMod) {
                targets.push({
                    id: 't-' + Math.random().toString(36).substring(2, 9),
                    isCustom: false,
                    moduleId: matchingMod.id,
                    customText: ''
                });
            } else {
                targets.push({
                    id: 't-' + Math.random().toString(36).substring(2, 9),
                    isCustom: true,
                    moduleId: subMods.length > 0 ? subMods[0].id : '',
                    customText: trimmed
                });
            }
        });
    } else if (existingModuleId) {
        targets.push({
            id: 't-' + Math.random().toString(36).substring(2, 9),
            isCustom: false,
            moduleId: existingModuleId,
            customText: ''
        });
    }

    if (targets.length === 0) {
        targets.push({
            id: 't-' + Math.random().toString(36).substring(2, 9),
            isCustom: subMods.length === 0,
            moduleId: subMods.length > 0 ? subMods[0].id : '',
            customText: ''
        });
    }

    return { parsedDateStr, targets };
}

export default function EditCourseScheduleModal({
    schedule,
    availableModules = [],
    isOpen,
    onClose
}: EditCourseScheduleModalProps) {
    const [subjectName, setSubjectName] = useState(schedule.subject_name);
    const [dayOfWeek, setDayOfWeek] = useState<number>(schedule.day_of_week);
    const [scheduleDate, setScheduleDate] = useState<string>('');
    const [startTime, setStartTime] = useState(schedule.start_time.slice(0, 5));
    const [endTime, setEndTime] = useState(schedule.end_time.slice(0, 5));
    const [studyMethod, setStudyMethod] = useState(schedule.room || UT_METHODS[0]);
    const [tutor, setTutor] = useState(schedule.lecturer || '');

    const [targets, setTargets] = useState<TargetItem[]>([]);

    const [isPending, startTransition] = useTransition();
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    // Modul yang relevan dengan mata kuliah yang sedang dipilih
    const currentSubjectModules = useMemo(() => {
        if (!subjectName) return [];
        return availableModules.filter(
            (m) => m.subject_name?.trim().toLowerCase() === subjectName.trim().toLowerCase()
        );
    }, [availableModules, subjectName]);

    useEffect(() => {
        if (isOpen) {
            setSubjectName(schedule.subject_name);
            setDayOfWeek(schedule.day_of_week);
            setStartTime(schedule.start_time.slice(0, 5));
            setEndTime(schedule.end_time.slice(0, 5));
            setStudyMethod(schedule.room || UT_METHODS[0]);
            setTutor(schedule.lecturer || '');

            const { parsedDateStr, targets: parsedTargets } = parseScheduleData(
                schedule.target_material,
                schedule.day_of_week,
                availableModules,
                schedule.subject_name,
                schedule.module_id
            );

            setScheduleDate(parsedDateStr);
            setTargets(parsedTargets);
            setErrorMessage('');
            setSuccessMessage('');
        }
    }, [isOpen, schedule, availableModules]);

    if (!isOpen) return null;

    // Handle ganti tanggal
    const handleDateChange = (val: string) => {
        setScheduleDate(val);
        if (val) {
            const d = new Date(val + 'T00:00:00');
            if (!isNaN(d.getTime())) {
                setDayOfWeek(d.getDay());
            }
        }
    };

    // Handle ganti hari secara manual
    const handleDayChange = (newDay: number) => {
        setDayOfWeek(newDay);
        if (scheduleDate) {
            const d = new Date(scheduleDate + 'T00:00:00');
            if (!isNaN(d.getTime())) {
                const cur = d.getDay();
                let diff = newDay - cur;
                d.setDate(d.getDate() + diff);
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                setScheduleDate(`${year}-${month}-${day}`);
            }
        }
    };

    // Helper Multi-Target
    const handleAddTarget = () => {
        setTargets((prev) => [
            ...prev,
            {
                id: 't-' + Math.random().toString(36).substring(2, 9),
                isCustom: currentSubjectModules.length === 0,
                moduleId: currentSubjectModules.length > 0 ? currentSubjectModules[0].id : '',
                customText: ''
            }
        ]);
    };

    const handleRemoveTarget = (id: string) => {
        if (targets.length <= 1) return;
        setTargets((prev) => prev.filter((t) => t.id !== id));
    };

    const handleUpdateTarget = (id: string, updates: Partial<TargetItem>) => {
        setTargets((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
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

        const targetStrings: string[] = [];
        let firstModuleId: string | null = null;

        for (const t of targets) {
            if (!t.isCustom && t.moduleId) {
                const foundMod = currentSubjectModules.find((m) => m.id === t.moduleId);
                if (foundMod) {
                    targetStrings.push(`${foundMod.module_title} • ${foundMod.kb_title}`);
                    if (!firstModuleId) firstModuleId = foundMod.id;
                }
            } else if (t.customText.trim()) {
                targetStrings.push(t.customText.trim());
            }
        }

        let dateTag = '';
        if (scheduleDate) {
            const d = new Date(scheduleDate + 'T00:00:00');
            if (!isNaN(d.getTime())) {
                const dateFormatted = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
                dateTag = `[${dateFormatted}]`;
            }
        }

        let finalTargetMaterial = targetStrings.join(', ');
        if (dateTag) {
            finalTargetMaterial = finalTargetMaterial ? `${dateTag} ${finalTargetMaterial}` : dateTag;
        }

        startTransition(async () => {
            try {
                await updateCourseSchedule({
                    id: schedule.id,
                    subjectName: subjectName.trim(),
                    dayOfWeek,
                    startTime,
                    endTime,
                    room: studyMethod.trim() || null,
                    lecturer: tutor.trim() || null,
                    targetMaterial: finalTargetMaterial || null,
                    moduleId: firstModuleId
                });

                setSuccessMessage('Jadwal belajar mandiri diperbarui!');
                setTimeout(() => {
                    onClose();
                    setSuccessMessage('');
                }, 1000);
            } catch (err: any) {
                setErrorMessage(err?.message || 'Gagal memperbarui jadwal');
            }
        });
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
            <div className="bg-surface w-full max-w-lg rounded-t-[28px] sm:rounded-[28px] p-6 pb-28 sm:pb-6 shadow-2xl max-h-[90dvh] overflow-y-auto border border-surface-variant flex flex-col">
                {/* Header Modal */}
                <div className="flex justify-between items-center mb-5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                            <Edit2 className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-extrabold text-on-surface">Edit Jadwal Belajar Mandiri</h2>
                            <p className="text-xs text-secondary mt-0.5">Ubah tanggal, jam, atau target materi UT</p>
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
                    {/* 1. Mata Kuliah */}
                    <div>
                        <label className="text-xs font-bold text-secondary mb-1.5 block">Mata Kuliah *</label>
                        <input
                            type="text"
                            required
                            value={subjectName}
                            onChange={(e) => setSubjectName(e.target.value)}
                            className="w-full bg-surface-container border border-surface-variant rounded-xl px-4 py-3 text-on-surface text-sm font-semibold focus:outline-none focus:border-primary"
                        />
                    </div>

                    {/* 2. Tanggal & Hari Belajar */}
                    <div className="bg-surface-container-low border border-surface-variant rounded-2xl p-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2">
                            <div>
                                <label className="text-xs font-bold text-secondary mb-1.5 flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5 text-primary" /> Tanggal Belajar *
                                </label>
                                <input
                                    type="date"
                                    required
                                    value={scheduleDate}
                                    onChange={(e) => handleDateChange(e.target.value)}
                                    className="w-full bg-surface border border-surface-variant rounded-xl px-3.5 py-2.5 text-on-surface text-xs font-bold focus:outline-none focus:border-primary"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-secondary mb-1.5 block">Hari Belajar</label>
                                <select
                                    value={dayOfWeek}
                                    onChange={(e) => handleDayChange(Number(e.target.value))}
                                    className="w-full bg-surface border border-surface-variant rounded-xl px-3.5 py-2.5 text-on-surface text-xs font-bold focus:outline-none focus:border-primary"
                                >
                                    {DAYS.map((d) => (
                                        <option key={d.id} value={d.id}>
                                            {d.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {scheduleDate && (
                            <p className="text-[11px] text-primary font-medium flex items-center gap-1 mt-1">
                                🗓️ Terjadwal untuk: <strong className="font-bold">{formatDisplayDate(scheduleDate)}</strong>
                            </p>
                        )}
                    </div>

                    {/* 3. Target Materi yang Dipelajari (Multi-Target dengan Tombol Plus) */}
                    <div className="bg-surface-container-low border border-surface-variant rounded-2xl p-4 flex flex-col gap-3">
                        <div className="flex justify-between items-center">
                            <label className="text-xs font-bold text-primary flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5" /> Target Materi yang Dipelajari ({targets.length})
                            </label>
                            <span className="text-[10px] text-secondary">Bisa lebih dari 1 target</span>
                        </div>

                        <div className="flex flex-col gap-2.5">
                            {targets.map((target, idx) => (
                                <div
                                    key={target.id}
                                    className="p-3 bg-surface rounded-xl border border-surface-variant flex flex-col gap-2 shadow-xs"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-extrabold text-on-surface flex items-center gap-1.5">
                                            <span className="w-4 h-4 rounded-full bg-primary/10 text-primary text-[10px] flex items-center justify-center font-bold">
                                                {idx + 1}
                                            </span>
                                            Target #{idx + 1}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            {currentSubjectModules.length > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleUpdateTarget(target.id, { isCustom: !target.isCustom })}
                                                    className="text-[10px] font-bold text-primary hover:underline"
                                                >
                                                    {target.isCustom ? 'Pilih Modul Terdaftar' : 'Ketik Manual'}
                                                </button>
                                            )}
                                            {targets.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveTarget(target.id)}
                                                    className="w-6 h-6 rounded-lg bg-surface-container hover:bg-red-50 hover:text-danger flex items-center justify-center text-secondary transition-colors"
                                                    title="Hapus target ini"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {!target.isCustom && currentSubjectModules.length > 0 ? (
                                        <select
                                            value={target.moduleId}
                                            onChange={(e) => handleUpdateTarget(target.id, { moduleId: e.target.value })}
                                            className="w-full bg-surface-container border border-surface-variant rounded-xl px-3 py-2 text-on-surface text-xs font-semibold focus:outline-none focus:border-primary"
                                        >
                                            {currentSubjectModules.map((m) => (
                                                <option key={m.id} value={m.id}>
                                                    {m.module_title} • {m.kb_title} {m.is_completed ? '✅ (Selesai)' : ''}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input
                                            type="text"
                                            value={target.customText}
                                            onChange={(e) => handleUpdateTarget(target.id, { customText: e.target.value })}
                                            placeholder="Contoh: Baca BMP Modul 2 hal 2.1-2.30"
                                            className="w-full bg-surface-container border border-surface-variant rounded-xl px-3 py-2 text-on-surface text-xs font-semibold focus:outline-none focus:border-primary placeholder:text-outline"
                                        />
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Tombol Tambah Target */}
                        <button
                            type="button"
                            onClick={handleAddTarget}
                            className="flex items-center justify-center gap-1.5 w-full py-2.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl text-xs font-bold transition-all active:scale-[0.99] border border-dashed border-primary/30"
                        >
                            <Plus className="w-4 h-4" /> Tambah Target Materi
                        </button>
                    </div>

                    {/* 4. Jam Belajar */}
                    <div className="grid grid-cols-2 gap-3">
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

                    {/* 5. Metode Belajar UT */}
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

                    {/* 6. Tutor / Pengampu (Opsional) */}
                    <div>
                        <label className="text-xs font-bold text-secondary mb-1 block">
                            Tutor / Dosen UT (Opsional)
                        </label>
                        <input
                            type="text"
                            value={tutor}
                            onChange={(e) => setTutor(e.target.value)}
                            placeholder="Contoh: Tutor Tuton"
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
                            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4" /> Simpan Perubahan</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
