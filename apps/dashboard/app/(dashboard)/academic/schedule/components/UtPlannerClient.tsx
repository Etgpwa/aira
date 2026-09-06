'use client';

import { useState, useEffect, useTransition, useMemo } from 'react';
import Link from 'next/link';
import {
    Calendar,
    Clock,
    BookOpen,
    Sparkles,
    CheckCircle2,
    Circle,
    Trophy,
    ChevronLeft,
    Plus,
    Trash2,
    Edit2,
    ExternalLink,
    GraduationCap,
    Check,
    AlertCircle,
    CalendarDays,
    BookMarked,
    Layers,
    ArrowRight
} from 'lucide-react';
import {
    setSemesterStartDate,
    saveWeeklyTarget,
    deleteWeeklyTarget,
    toggleWeeklyTargetStatus,
    assignModuleToWeek,
    deleteCoursePlan,
    deleteWeekForSubject
} from '@/app/(dashboard)/academic/planner-actions';
import AddCourseScheduleModal from '@/app/(dashboard)/academic/components/AddCourseScheduleModal';
import EditCourseScheduleModal from '@/app/(dashboard)/academic/components/EditCourseScheduleModal';

const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

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

interface WeeklyTarget {
    id: string;
    subject_name: string;
    week_number: number;
    topic: string;
    is_completed: boolean;
    notes?: string | null;
}

interface ModuleItem {
    id: string;
    subject_name: string;
    module_title: string;
    kb_title: string;
    week_number?: number | null;
    is_completed?: boolean;
    best_score?: number | null;
    course_quiz_questions?: { count: number }[];
}

interface UtPlannerClientProps {
    initialSemesterStartDate: string | null;
    currentWeekNumber: number;
    schedules: CourseSchedule[];
    weeklyTargets: WeeklyTarget[];
    modules: ModuleItem[];
}

export default function UtPlannerClient({
    initialSemesterStartDate,
    currentWeekNumber,
    schedules,
    weeklyTargets,
    modules
}: UtPlannerClientProps) {
    const [isPending, startTransition] = useTransition();

    // Semester Start Date State
    const [isEditingSemester, setIsEditingSemester] = useState(false);
    const [semesterStartDate, setSemesterStartDateState] = useState(
        initialSemesterStartDate ? initialSemesterStartDate.split('T')[0] : ''
    );

    // List unik mata kuliah dari schedules dan modules
    const allSubjects = useMemo(() => {
        const set = new Set<string>();
        schedules.forEach((s) => s.subject_name && set.add(s.subject_name.trim()));
        modules.forEach((m) => m.subject_name && set.add(m.subject_name.trim()));
        weeklyTargets.forEach((t) => t.subject_name && set.add(t.subject_name.trim()));
        return Array.from(set);
    }, [schedules, modules, weeklyTargets]);

    const [selectedSubject, setSelectedSubject] = useState<string>(allSubjects[0] || '');

    // State Edit Schedule Modal
    const [editingSchedule, setEditingSchedule] = useState<CourseSchedule | null>(null);

    // State Tambah Target Modal
    const [targetModalOpen, setTargetModalOpen] = useState(false);
    const [targetModalWeek, setTargetModalWeek] = useState<number>(1);
    const [targetTopicInput, setTargetTopicInput] = useState('');
    const [targetModuleIdInput, setTargetModuleIdInput] = useState('');
    const [modalError, setModalError] = useState('');

    // Jadwal untuk subject yang aktif
    const currentSchedule = useMemo(() => {
        return schedules.find(
            (s) => s.subject_name.toLowerCase() === selectedSubject.toLowerCase()
        );
    }, [schedules, selectedSubject]);

    // Modul milik subject yang aktif
    const subjectModules = useMemo(() => {
        return modules.filter(
            (m) => m.subject_name.toLowerCase() === selectedSubject.toLowerCase()
        );
    }, [modules, selectedSubject]);

    // Target mingguan milik subject yang aktif
    const subjectTargets = useMemo(() => {
        return weeklyTargets.filter(
            (t) => t.subject_name.toLowerCase() === selectedSubject.toLowerCase()
        );
    }, [weeklyTargets, selectedSubject]);

    // Handler simpan tanggal semester
    const handleSaveSemesterDate = () => {
        if (!semesterStartDate) return;
        startTransition(async () => {
            try {
                await setSemesterStartDate(semesterStartDate);
                setIsEditingSemester(false);
            } catch (err: any) {
                alert(err?.message || 'Gagal menyimpan tanggal semester');
            }
        });
    };

    // Handler toggle status target
    const handleToggleTarget = (targetId: string, currentStatus: boolean) => {
        startTransition(async () => {
            try {
                await toggleWeeklyTargetStatus(targetId, !currentStatus);
            } catch (err: any) {
                alert(err?.message || 'Gagal memperbarui status target');
            }
        });
    };

    // Handler hapus target
    const handleDeleteTarget = (targetId: string) => {
        if (!confirm('Hapus target mingguan ini?')) return;
        startTransition(async () => {
            try {
                await deleteWeeklyTarget(targetId);
            } catch (err: any) {
                alert(err?.message || 'Gagal menghapus target');
            }
        });
    };

    // Handler unlink modul dari minggu
    const handleUnlinkModule = (moduleId: string) => {
        startTransition(async () => {
            try {
                await assignModuleToWeek(moduleId, null);
            } catch (err: any) {
                alert(err?.message || 'Gagal melepas modul');
            }
        });
    };

    // Handler hapus mata kuliah & target terkait
    const handleDeleteCourse = () => {
        if (!selectedSubject) return;
        if (!confirm(`Hapus mata kuliah "${selectedSubject}" beserta seluruh jadwal belajar dan target silabusnya?`)) return;

        startTransition(async () => {
            try {
                await deleteCoursePlan(selectedSubject);
                const remaining = allSubjects.filter(
                    (s) => s.toLowerCase() !== selectedSubject.toLowerCase()
                );
                setSelectedSubject(remaining[0] || '');
            } catch (err: any) {
                alert(err?.message || 'Gagal menghapus mata kuliah');
            }
        });
    };

    // Handler hapus minggu (jika ada target/modul, konfirmasi & hapus DB; jika kosong, langsung kurangi totalWeeks)
    const handleDeleteWeek = (weekNum: number) => {
        if (!selectedSubject) return;

        const hasTargets = subjectTargets.some((t) => t.week_number === weekNum);
        const hasModules = subjectModules.some((m) => m.week_number === weekNum);

        if (hasTargets || hasModules) {
            if (
                !confirm(
                    `Sesi / Minggu ${weekNum} memiliki target belajar atau modul KB terkait. Yakin ingin menghapus minggu ${weekNum} beserta target di dalamnya?`
                )
            ) {
                return;
            }

            startTransition(async () => {
                try {
                    await deleteWeekForSubject(selectedSubject, weekNum);
                    setTotalWeeks((prev) => Math.max(8, prev - 1));
                } catch (err: any) {
                    alert(err?.message || 'Gagal menghapus minggu');
                }
            });
        } else {
            // Kosong (misal kepencet tambah minggu lalu kelebihan)
            setTotalWeeks((prev) => Math.max(8, prev - 1));
        }
    };

    // Tentukan jumlah minggu maksimal untuk matkul yang dipilih (minimal 8)
    const subjectMaxWeek = useMemo(() => {
        const targetWeeks = subjectTargets.map((t) => t.week_number || 8);
        const moduleWeeks = subjectModules.map((m) => m.week_number || 8);
        return Math.max(8, ...targetWeeks, ...moduleWeeks);
    }, [subjectTargets, subjectModules]);

    const [totalWeeks, setTotalWeeks] = useState<number>(subjectMaxWeek);

    // Saat ganti matkul, sinkronkan totalWeeks dengan target matkul tersebut
    useEffect(() => {
        setTotalWeeks(subjectMaxWeek);
    }, [selectedSubject]);

    // Jika ada target baru di luar batas totalWeeks saat ini, perluas otomatis
    useEffect(() => {
        setTotalWeeks((prev) => Math.max(prev, subjectMaxWeek));
    }, [subjectMaxWeek]);

    // Buka modal tambah target untuk minggu N
    const openAddTargetModal = (weekNum: number) => {
        setTargetModalWeek(weekNum);
        setTargetTopicInput('');
        setTargetModuleIdInput('');
        setModalError('');
        setTargetModalOpen(true);
    };

    // Simpan target dari modal
    const handleSaveTargetModal = () => {
        if (!selectedSubject) {
            setModalError('Pilih mata kuliah terlebih dahulu');
            return;
        }

        // Cari judul jika user memilih modul
        let finalTopic = targetTopicInput.trim();
        if (targetModuleIdInput) {
            const selectedMod = subjectModules.find((m) => m.id === targetModuleIdInput);
            if (selectedMod && !finalTopic) {
                finalTopic = `${selectedMod.module_title}: ${selectedMod.kb_title}`;
            }
        }

        if (!finalTopic && !targetModuleIdInput) {
            setModalError('Masukkan topik target atau pilih modul KB');
            return;
        }

        startTransition(async () => {
            try {
                if (finalTopic) {
                    await saveWeeklyTarget({
                        subjectName: selectedSubject,
                        weekNumber: targetModalWeek,
                        topic: finalTopic
                    });
                }
                if (targetModuleIdInput) {
                    await assignModuleToWeek(targetModuleIdInput, targetModalWeek);
                }
                setTargetModalOpen(false);
            } catch (err: any) {
                setModalError(err?.message || 'Gagal menyimpan target');
            }
        });
    };

    // Hitung progres mata kuliah terpilih
    const statsForCurrentSubject = useMemo(() => {
        const finishedWeeks = subjectTargets.filter((t) => t.is_completed).length;
        const pct = totalWeeks > 0 ? Math.round((finishedWeeks / totalWeeks) * 100) : 0;
        return { totalWeeks, finishedWeeks, pct };
    }, [subjectTargets, totalWeeks]);

    return (
        <div className="min-h-screen bg-surface px-1 sm:px-2 space-y-6 pb-20">
            {/* Top Navigation / Breadcrumb */}
            <header className="flex justify-between items-center mb-4 px-1 pt-1">
                <div className="flex items-center gap-3">
                    <Link
                        href="/academic"
                        className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-secondary hover:text-on-surface transition-colors active:scale-95"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-on-surface flex items-center gap-2">
                            <span>Jadwal & Target Kuliah UT</span>
                            <span className="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                                {totalWeeks} Sesi Mandiri
                            </span>
                        </h1>
                        <p className="text-secondary text-xs mt-0.5">
                            Roadmap silabus per minggu & auto-query materi harian
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <AddCourseScheduleModal
                        defaultSubject={selectedSubject}
                        availableModules={modules}
                        triggerButton={
                            <button className="px-3 py-1.5 rounded-full bg-primary text-white text-xs font-bold flex items-center gap-1.5 shadow-sm hover:opacity-90 active:scale-95 transition-all">
                                <Plus className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Tambah Matkul</span>
                                <span className="sm:hidden">Matkul</span>
                            </button>
                        }
                    />
                </div>
            </header>

            {/* 1. KARTU STATUS SEMESTER & KALKULASI MINGGU */}
            <section className="bg-surface-bright border border-surface-variant rounded-[24px] p-5 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start sm:items-center gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-accent-gradient text-white flex items-center justify-center flex-shrink-0 shadow-md">
                            <CalendarDays className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-secondary uppercase tracking-wider">
                                    Semester UT Aktif
                                </span>
                                <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-primary text-white">
                                    Minggu ke-{currentWeekNumber} / Sesi {currentWeekNumber}
                                </span>
                            </div>
                            <p className="text-sm font-extrabold text-on-surface mt-0.5">
                                {semesterStartDate ? (
                                    <>
                                        Dimulai sejak{' '}
                                        {new Date(semesterStartDate + 'T00:00:00').toLocaleDateString('id-ID', {
                                            day: 'numeric',
                                            month: 'long',
                                            year: 'numeric'
                                        })}
                                    </>
                                ) : (
                                    <span className="text-amber-600 font-semibold">
                                        Tanggal awal semester belum diset
                                    </span>
                                )}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {isEditingSemester ? (
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                <input
                                    type="date"
                                    value={semesterStartDate}
                                    onChange={(e) => setSemesterStartDateState(e.target.value)}
                                    className="px-3 py-1.5 text-xs bg-surface-container border border-surface-variant rounded-xl font-bold text-on-surface outline-none focus:ring-2 focus:ring-primary/40"
                                />
                                <button
                                    onClick={handleSaveSemesterDate}
                                    disabled={isPending || !semesterStartDate}
                                    className="px-3 py-1.5 bg-primary text-white rounded-xl text-xs font-bold hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
                                >
                                    Simpan
                                </button>
                                <button
                                    onClick={() => setIsEditingSemester(false)}
                                    className="px-3 py-1.5 bg-surface-container text-secondary rounded-xl text-xs font-bold hover:text-on-surface"
                                >
                                    Batal
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setIsEditingSemester(true)}
                                className="px-3.5 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high border border-surface-variant text-secondary hover:text-on-surface text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95"
                            >
                                <Calendar className="w-3.5 h-3.5" />
                                <span>{semesterStartDate ? 'Ubah Tanggal Awal' : 'Set Tanggal Awal'}</span>
                            </button>
                        )}
                    </div>
                </div>
            </section>

            {/* 2. TAB PILIH MATA KULIAH */}
            <section className="space-y-3">
                <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-secondary flex items-center gap-1.5">
                        <BookMarked className="w-4 h-4 text-primary" /> Daftar Mata Kuliah
                    </span>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-secondary font-medium hidden sm:inline">
                            {allSubjects.length} Mata Kuliah
                        </span>
                        <AddCourseScheduleModal
                            availableModules={modules}
                            triggerButton={
                                <button className="px-2.5 py-1 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-xs font-bold flex items-center gap-1 transition-all active:scale-95">
                                    <Plus className="w-3.5 h-3.5" /> Tambah Matkul
                                </button>
                            }
                        />
                    </div>
                </div>

                {allSubjects.length === 0 ? (
                    <div className="bg-surface-container rounded-[20px] p-6 text-center">
                        <BookOpen className="w-8 h-8 text-secondary mx-auto mb-2 opacity-50" />
                        <p className="text-sm font-bold text-on-surface">Belum ada mata kuliah</p>
                        <p className="text-xs text-secondary mt-0.5 mb-3">
                            Tambahkan jadwal belajar mandiri untuk mata kuliah pertamamu.
                        </p>
                        <AddCourseScheduleModal
                            availableModules={modules}
                            triggerButton={
                                <button className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm">
                                    <Plus className="w-4 h-4" /> Tambah Mata Kuliah
                                </button>
                            }
                        />
                    </div>
                ) : (
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                        {allSubjects.map((sub) => {
                            const isSelected = sub.toLowerCase() === selectedSubject.toLowerCase();
                            const sched = schedules.find(
                                (s) => s.subject_name.toLowerCase() === sub.toLowerCase()
                            );
                            return (
                                <button
                                    key={sub}
                                    onClick={() => setSelectedSubject(sub)}
                                    className={`px-4 py-2.5 rounded-[18px] text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 border flex-shrink-0 active:scale-95 ${
                                        isSelected
                                            ? 'bg-primary text-white border-primary shadow-sm ring-2 ring-primary/20'
                                            : 'bg-surface-bright text-secondary border-surface-variant hover:border-primary/40 hover:text-on-surface'
                                    }`}
                                >
                                    <BookOpen className="w-3.5 h-3.5" />
                                    <span>{sub}</span>
                                    {sched && (
                                        <span
                                            className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                                                isSelected ? 'bg-white/20 text-white' : 'bg-surface-container text-secondary'
                                            }`}
                                        >
                                            {DAY_NAMES[sched.day_of_week]}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}
            </section>

            {/* 3. DETAIL JADWAL & PROGRES MATKUL AKTIF */}
            {selectedSubject && (
                <section className="bg-surface-bright border border-surface-variant rounded-[24px] p-5 shadow-xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-variant/60 pb-4">
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg font-extrabold text-on-surface">{selectedSubject}</h2>
                                {currentSchedule?.room && (
                                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-surface-container text-secondary">
                                        {currentSchedule.room}
                                    </span>
                                )}
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-xs text-secondary mt-1">
                                {currentSchedule ? (
                                    <>
                                        <span className="flex items-center gap-1 font-bold text-primary">
                                            <Calendar className="w-3.5 h-3.5" />
                                            Setiap {DAY_NAMES[currentSchedule.day_of_week]}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-3.5 h-3.5" />
                                            {currentSchedule.start_time.slice(0, 5)} -{' '}
                                            {currentSchedule.end_time.slice(0, 5)}
                                        </span>
                                        {currentSchedule.lecturer && (
                                            <span>Tutor: {currentSchedule.lecturer}</span>
                                        )}
                                    </>
                                ) : (
                                    <span className="text-amber-600 italic">
                                        Belum memiliki jadwal hari belajar rutin
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {currentSchedule ? (
                                <>
                                    <button
                                        onClick={() => setEditingSchedule(currentSchedule)}
                                        className="px-3 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high border border-surface-variant text-secondary text-xs font-bold flex items-center gap-1.5 transition-colors"
                                    >
                                        <Edit2 className="w-3.5 h-3.5" /> Ubah Jam
                                    </button>
                                    <button
                                        onClick={handleDeleteCourse}
                                        disabled={isPending}
                                        className="w-8 h-8 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-600 flex items-center justify-center transition-colors active:scale-95 disabled:opacity-50 flex-shrink-0"
                                        title="Hapus mata kuliah ini"
                                        aria-label="Hapus mata kuliah ini"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </>
                            ) : (
                                <>
                                    <AddCourseScheduleModal
                                        defaultSubject={selectedSubject}
                                        availableModules={modules}
                                        triggerButton={
                                            <button className="px-3 py-1.5 rounded-xl bg-primary/10 text-primary border border-primary/20 text-xs font-bold flex items-center gap-1.5">
                                                <Clock className="w-3.5 h-3.5" /> Atur Jam Belajar
                                            </button>
                                        }
                                    />
                                    <button
                                        onClick={handleDeleteCourse}
                                        disabled={isPending}
                                        className="w-8 h-8 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-600 flex items-center justify-center transition-colors active:scale-95 disabled:opacity-50 flex-shrink-0"
                                        title="Hapus mata kuliah ini"
                                        aria-label="Hapus mata kuliah ini"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Progress Bar Sesi Terpenuhi */}
                    <div>
                        <div className="flex justify-between items-center text-xs mb-1.5">
                            <span className="font-bold text-secondary">Progres Silabus UT ({totalWeeks} Sesi)</span>
                            <span className="font-extrabold text-on-surface">
                                {statsForCurrentSubject.finishedWeeks} / {statsForCurrentSubject.totalWeeks} Sesi (
                                {statsForCurrentSubject.pct}%)
                            </span>
                        </div>
                        <div className="w-full bg-surface-container rounded-full h-2.5 overflow-hidden">
                            <div
                                className="bg-accent-gradient h-full rounded-full transition-all duration-500"
                                style={{ width: `${statsForCurrentSubject.pct}%` }}
                            />
                        </div>
                    </div>
                </section>
            )}

            {/* 4. MATRIX ROADMAP SESI / MINGGU */}
            {selectedSubject && (
                <section className="space-y-4">
                    <div className="flex flex-wrap justify-between items-center gap-2 px-1">
                        <div>
                            <h3 className="text-sm font-extrabold text-secondary uppercase tracking-wider flex items-center gap-1.5">
                                <Layers className="w-4 h-4 text-primary" /> Roadmap Silabus ({totalWeeks} Sesi / Minggu)
                            </h3>
                            <p className="text-xs text-secondary mt-0.5">
                                Tentukan materi KB yang harus dipelajari pada masing-masing sesi
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            {totalWeeks > 8 && (
                                <button
                                    type="button"
                                    onClick={() => handleDeleteWeek(totalWeeks)}
                                    disabled={isPending}
                                    className="px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-600 border border-red-500/20 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 shadow-xs disabled:opacity-50"
                                    title={`Hapus Sesi / Minggu ${totalWeeks}`}
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Hapus Minggu {totalWeeks}</span>
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => setTotalWeeks((prev) => prev + 1)}
                                className="px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 shadow-xs"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Tambah Minggu (Sesi {totalWeeks + 1})</span>
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Array.from({ length: totalWeeks }, (_, i) => i + 1).map((weekNum) => {
                            const isCurrentWeek = weekNum === currentWeekNumber;
                            const target = subjectTargets.find((t) => t.week_number === weekNum);
                            const linkedModules = subjectModules.filter(
                                (m) => m.week_number === weekNum
                            );

                            const isDone = target?.is_completed || false;

                            return (
                                <div
                                    key={weekNum}
                                    className={`rounded-[22px] p-4 sm:p-5 border transition-all flex flex-col justify-between ${
                                        isCurrentWeek
                                            ? 'bg-primary/5 border-primary/40 ring-1 ring-primary/20 shadow-sm'
                                            : isDone
                                            ? 'bg-surface-bright border-mint-border/50'
                                            : 'bg-surface-bright border-surface-variant'
                                    }`}
                                >
                                    <div>
                                        {/* Header Minggu */}
                                        <div className="flex justify-between items-center mb-3">
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className={`text-xs font-black px-2.5 py-0.5 rounded-full ${
                                                        isCurrentWeek
                                                            ? 'bg-primary text-white shadow-xs'
                                                            : 'bg-surface-container text-on-surface'
                                                    }`}
                                                >
                                                    Sesi / Minggu {weekNum}
                                                </span>
                                                {isCurrentWeek && (
                                                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-primary flex items-center gap-1">
                                                        <Sparkles className="w-3 h-3" /> Aktif Sekarang
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-1.5">
                                                {target && (
                                                    <button
                                                        onClick={() => handleToggleTarget(target.id, target.is_completed)}
                                                        className={`text-xs font-bold flex items-center gap-1 px-2.5 py-1 rounded-full transition-colors ${
                                                            target.is_completed
                                                                ? 'bg-mint-bg text-mint-fg'
                                                                : 'bg-surface-container text-secondary hover:text-on-surface'
                                                        }`}
                                                    >
                                                        {target.is_completed ? (
                                                            <>
                                                                <CheckCircle2 className="w-3.5 h-3.5" /> Selesai
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Circle className="w-3.5 h-3.5" /> Belum
                                                            </>
                                                        )}
                                                    </button>
                                                )}
                                                {weekNum > 8 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteWeek(weekNum)}
                                                        disabled={isPending}
                                                        className="w-7 h-7 rounded-lg text-secondary hover:text-red-500 hover:bg-red-500/10 transition-colors flex items-center justify-center disabled:opacity-50"
                                                        title={`Hapus Sesi / Minggu ${weekNum}`}
                                                        aria-label={`Hapus Sesi / Minggu ${weekNum}`}
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Konten Target Topik */}
                                        <div className="space-y-2 mb-3">
                                            {target ? (
                                                <div className="bg-surface-container-low border border-surface-variant rounded-xl p-3 flex justify-between items-start gap-2">
                                                    <div>
                                                        <span className="text-[10px] font-bold text-primary uppercase tracking-wider">
                                                            Target Belajar:
                                                        </span>
                                                        <p className="text-xs font-bold text-on-surface mt-0.5 leading-snug">
                                                            {target.topic}
                                                        </p>
                                                    </div>
                                                    <button
                                                        onClick={() => handleDeleteTarget(target.id)}
                                                        className="text-secondary hover:text-red-500 p-1 rounded-lg transition-colors flex-shrink-0"
                                                        title="Hapus target"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="bg-surface-container/50 border border-dashed border-surface-variant rounded-xl p-3 text-center">
                                                    <p className="text-xs text-secondary italic">
                                                        Belum ada target tertulis untuk minggu {weekNum}
                                                    </p>
                                                </div>
                                            )}

                                            {/* Modul KB yang terhubung ke minggu ini */}
                                            {linkedModules.length > 0 && (
                                                <div className="space-y-1.5 pt-1">
                                                    <span className="text-[10px] font-bold text-secondary uppercase tracking-wider flex items-center gap-1">
                                                        <BookOpen className="w-3 h-3 text-primary" /> Modul & Kuis
                                                        Terkait:
                                                    </span>
                                                    {linkedModules.map((m) => {
                                                        const qCount = m.course_quiz_questions?.[0]?.count ?? 0;
                                                        return (
                                                            <div
                                                                key={m.id}
                                                                className="bg-surface-container border border-surface-variant rounded-xl p-2.5 flex items-center justify-between gap-2"
                                                            >
                                                                <div className="flex items-center gap-2 min-w-0">
                                                                    <div
                                                                        className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                                                                            m.is_completed
                                                                                ? 'bg-mint-bg text-mint-fg'
                                                                                : 'bg-primary/10 text-primary'
                                                                        }`}
                                                                    >
                                                                        {m.is_completed ? (
                                                                            <CheckCircle2 className="w-4 h-4" />
                                                                        ) : (
                                                                            <BookOpen className="w-3.5 h-3.5" />
                                                                        )}
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <p className="text-xs font-bold text-on-surface truncate">
                                                                            {m.kb_title}
                                                                        </p>
                                                                        <p className="text-[10px] text-secondary truncate">
                                                                            {m.module_title} • {qCount} soal
                                                                            {m.best_score !== null &&
                                                                                ` • Skor: ${m.best_score}`}
                                                                        </p>
                                                                    </div>
                                                                </div>

                                                                <div className="flex items-center gap-1 flex-shrink-0">
                                                                    <Link
                                                                        href={`/academic/${m.id}`}
                                                                        className="p-1.5 rounded-lg bg-surface hover:bg-surface-container-high text-primary text-xs font-bold transition-colors"
                                                                        title="Buka KB & Kuis"
                                                                    >
                                                                        <ExternalLink className="w-3.5 h-3.5" />
                                                                    </Link>
                                                                    <button
                                                                        onClick={() => handleUnlinkModule(m.id)}
                                                                        className="p-1.5 rounded-lg hover:bg-surface-container-high text-secondary hover:text-red-500 text-xs transition-colors"
                                                                        title="Lepas keterkaitan minggu"
                                                                    >
                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Tombol Tambah / Link KB */}
                                    <div className="pt-2 border-t border-surface-variant/40 flex items-center justify-between gap-2">
                                        <button
                                            onClick={() => openAddTargetModal(weekNum)}
                                            className="w-full py-1.5 px-3 rounded-xl bg-surface-container hover:bg-surface-container-high text-secondary hover:text-on-surface text-xs font-bold flex items-center justify-center gap-1 transition-all active:scale-95"
                                        >
                                            <Plus className="w-3.5 h-3.5 text-primary" />
                                            <span>
                                                {target || linkedModules.length > 0
                                                    ? 'Edit / Hubungkan KB'
                                                    : 'Atur Target Sesi Ini'}
                                            </span>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Tombol Tambah Minggu Baru di Grid */}
                        <button
                            type="button"
                            onClick={() => setTotalWeeks((prev) => prev + 1)}
                            className="rounded-[22px] p-6 border-2 border-dashed border-surface-variant hover:border-primary/40 bg-surface-container/20 hover:bg-surface-container/50 text-secondary hover:text-primary transition-all flex flex-col items-center justify-center gap-2 min-h-[170px] active:scale-[0.99] group"
                        >
                            <div className="w-10 h-10 rounded-2xl bg-primary/10 group-hover:scale-110 text-primary flex items-center justify-center transition-transform shadow-xs">
                                <Plus className="w-5 h-5" />
                            </div>
                            <span className="text-xs font-extrabold text-on-surface">
                                Tambah Sesi / Minggu {totalWeeks + 1}
                            </span>
                            <span className="text-[11px] text-secondary text-center max-w-[240px]">
                                Perpanjang target silabus mata kuliah hingga minggu ke-{totalWeeks + 1}
                            </span>
                        </button>
                    </div>
                </section>
            )}

            {/* MODAL EDIT JADWAL JAM */}
            {editingSchedule && (
                <EditCourseScheduleModal
                    schedule={editingSchedule}
                    availableModules={modules}
                    isOpen={true}
                    onClose={() => setEditingSchedule(null)}
                />
            )}

            {/* MODAL TAMBAH / ATUR TARGET MINGGUAN */}
            {targetModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-surface w-full max-w-md rounded-[28px] p-6 shadow-2xl border border-surface-variant space-y-4">
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="text-base font-extrabold text-on-surface flex items-center gap-1.5">
                                    <Sparkles className="w-4 h-4 text-primary" />
                                    Atur Target Minggu {targetModalWeek}
                                </h3>
                                <p className="text-xs text-secondary mt-0.5">{selectedSubject}</p>
                            </div>
                            <button
                                onClick={() => setTargetModalOpen(false)}
                                className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-secondary hover:text-on-surface text-xs font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        {modalError && (
                            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                <span>{modalError}</span>
                            </div>
                        )}

                        {/* Pilih dari Modul KB yang sudah di-scan */}
                        {subjectModules.length > 0 && (
                            <div>
                                <label className="block text-xs font-bold text-secondary mb-1">
                                    Hubungkan dengan KB yang sudah discan:
                                </label>
                                <select
                                    value={targetModuleIdInput}
                                    onChange={(e) => setTargetModuleIdInput(e.target.value)}
                                    className="w-full px-3 py-2 text-xs bg-surface-container border border-surface-variant rounded-xl font-bold text-on-surface outline-none focus:ring-2 focus:ring-primary/40"
                                >
                                    <option value="">-- Tidak menghubungkan KB spesifik --</option>
                                    {subjectModules.map((m) => (
                                        <option key={m.id} value={m.id}>
                                            {m.module_title}: {m.kb_title}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Topik / Catatan Target Tertulis */}
                        <div>
                            <label className="block text-xs font-bold text-secondary mb-1">
                                Rincian / Topik Materi yang Dipelajari:
                            </label>
                            <textarea
                                value={targetTopicInput}
                                onChange={(e) => setTargetTopicInput(e.target.value)}
                                placeholder="Contoh: Modul 1 KB 1 (Konsep Dasar) & KB 2 (Manajemen Memori)"
                                rows={3}
                                className="w-full px-3 py-2 text-xs bg-surface-container border border-surface-variant rounded-xl font-medium text-on-surface outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                            />
                        </div>

                        <div className="flex gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setTargetModalOpen(false)}
                                className="flex-1 py-2.5 rounded-xl bg-surface-container text-secondary text-xs font-bold hover:text-on-surface transition-colors"
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveTargetModal}
                                disabled={isPending}
                                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-xs font-bold hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                            >
                                <Check className="w-4 h-4" /> Simpan Target
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
