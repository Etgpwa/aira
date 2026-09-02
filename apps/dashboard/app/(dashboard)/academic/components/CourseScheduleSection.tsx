'use client';

import { useState, useTransition } from 'react';
import {
    Clock,
    BookOpen,
    User,
    ChevronRight,
    Edit2,
    CheckCircle2,
    Sparkles,
    BookMarked,
    AlertTriangle,
    Calendar,
    X,
    Trash2,
    Layers
} from 'lucide-react';
import Link from 'next/link';
import AddCourseScheduleModal from './AddCourseScheduleModal';
import EditCourseScheduleModal from './EditCourseScheduleModal';
import { deleteCourseSchedule } from '../schedule-actions';

const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

interface CourseSchedule {
    id: string;
    subject_name: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    room?: string | null;           // Metode belajar UT (BMP, Tuweb, Tuton)
    lecturer?: string | null;       // Tutor / Dosen
    target_material?: string | null; // Target spesifik modul / bacaan
    module_id?: string | null;
}

interface ModuleItem {
    id: string;
    subject_name: string;
    module_title: string;
    kb_title: string;
    is_completed?: boolean;
    best_score?: number | null;
}

interface CourseScheduleSectionProps {
    schedules: CourseSchedule[];
    modules: ModuleItem[];
}

export default function CourseScheduleSection({ schedules, modules }: CourseScheduleSectionProps) {
    const [editingSchedule, setEditingSchedule] = useState<CourseSchedule | null>(null);
    const [isAllSchedulesModalOpen, setIsAllSchedulesModalOpen] = useState(false);
    const [isBacklogModalOpen, setIsBacklogModalOpen] = useState(false);
    const [isPending, startTransition] = useTransition();

    const todayDay = new Date().getDay();
    let yesterdayDay = todayDay - 1;
    if (yesterdayDay < 0) yesterdayDay = 6;

    // Helper untuk mencari modul aktif
    const getActiveModule = (schedule: CourseSchedule) => {
        if (schedule.module_id) {
            const found = modules.find((m) => m.id === schedule.module_id);
            if (found) return found;
        }
        const related = modules.filter(
            (m) =>
                m.subject_name.toLowerCase().includes(schedule.subject_name.toLowerCase()) ||
                schedule.subject_name.toLowerCase().includes(m.subject_name.toLowerCase())
        );
        return related.find((m) => !m.is_completed) || related[0] || null;
    };

    // 1. Jadwal Hari Ini
    const todaySchedules = schedules.filter((s) => s.day_of_week === todayDay);

    // 2. Jadwal Kemarin yang BELUM selesai kuisnya
    const yesterdayUnfinishedSchedules = schedules.filter((s) => {
        if (s.day_of_week !== yesterdayDay) return false;
        const activeMod = getActiveModule(s);
        return !activeMod?.is_completed;
    });

    // Gabungan Jadwal Aktif Utama (Maksimal Hari Ini & Kemarin Belum Selesai)
    const activeFocusSchedules = [...todaySchedules, ...yesterdayUnfinishedSchedules];

    // 3. Tunggakan Kuis: Jadwal dari 2 hari lalu atau lebih (> H-2) yang kuisnya BELUM selesai
    const backlogSchedules = schedules.filter((s) => {
        if (s.day_of_week === todayDay || s.day_of_week === yesterdayDay) return false;
        const activeMod = getActiveModule(s);
        return activeMod && !activeMod.is_completed;
    });

    const handleDelete = (id: string, name: string) => {
        if (!confirm(`Hapus jadwal belajar "${name}"?`)) return;

        startTransition(async () => {
            try {
                await deleteCourseSchedule(id);
            } catch (err: any) {
                alert(err?.message || 'Gagal menghapus jadwal');
            }
        });
    };

    return (
        <div className="my-8 px-1">
            {/* Header Section */}
            <div className="flex flex-wrap justify-between items-center gap-3 mb-5 px-1">
                <div>
                    <h3 className="text-sm font-extrabold text-secondary uppercase tracking-wider flex items-center gap-1.5">
                        <BookMarked className="w-4 h-4 text-primary" /> Jadwal Belajar Aktif
                    </h3>
                    <p className="text-xs text-secondary mt-0.5">
                        Fokus hari ini & evaluasi kuis tertunda
                    </p>
                </div>

                <div className="flex items-center gap-2.5">
                    {/* Tombol Kelola Seluruh Jadwal */}
                    {schedules.length > 0 && (
                        <button
                            onClick={() => setIsAllSchedulesModalOpen(true)}
                            className="px-3.5 py-1.5 rounded-full bg-surface-container hover:bg-surface-container-high text-secondary hover:text-on-surface text-xs font-bold transition-all border border-surface-variant flex items-center gap-1.5 active:scale-95"
                        >
                            <Calendar className="w-3.5 h-3.5" /> Kelola Semua ({schedules.length})
                        </button>
                    )}
                    <AddCourseScheduleModal availableModules={modules} />
                </div>
            </div>

            {/* GRID KARTU (Sejajar 2 Kolom, Margin & Padding Lega) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 lg:gap-6">
                {/* 1. KARTU JADWAL AKTIF HARI INI / KEMARIN */}
                {activeFocusSchedules.map((schedule) => {
                    const activeModule = getActiveModule(schedule);
                    const isToday = schedule.day_of_week === todayDay;
                    const isYesterday = schedule.day_of_week === yesterdayDay;

                    return (
                        <div
                            key={`active-${schedule.id}`}
                            className={`rounded-[24px] p-5 sm:p-6 shadow-xs flex flex-col justify-between border min-h-[220px] transition-all ${
                                isYesterday
                                    ? 'bg-amber-500/5 border-amber-400/40 ring-1 ring-amber-400/20'
                                    : 'bg-surface-bright border-primary/20 ring-1 ring-primary/10'
                            }`}
                        >
                            <div>
                                {/* Header Kartu */}
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-2">
                                        {isToday ? (
                                            <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider bg-primary text-white shadow-xs">
                                                Hari Ini • {DAY_NAMES[schedule.day_of_week]}
                                            </span>
                                        ) : (
                                            <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider bg-amber-500 text-white flex items-center gap-1 shadow-xs">
                                                <AlertTriangle className="w-3 h-3" /> Kemarin Belum Selesai
                                            </span>
                                        )}
                                        <span className="text-xs font-bold text-secondary flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {schedule.start_time.slice(0, 5)} - {schedule.end_time.slice(0, 5)}
                                        </span>
                                    </div>

                                    <button
                                        onClick={() => setEditingSchedule(schedule)}
                                        className="w-7 h-7 rounded-lg hover:bg-surface-container flex items-center justify-center text-secondary hover:text-primary transition-colors"
                                        title="Edit Jadwal"
                                    >
                                        <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>

                                {/* Nama Mata Kuliah */}
                                <h4 className="text-lg font-extrabold text-on-surface mb-1 truncate">
                                    {schedule.subject_name}
                                </h4>

                                {/* Metode Belajar UT & Tutor */}
                                <div className="flex flex-wrap items-center gap-2 text-xs text-secondary mb-3">
                                    {schedule.room && (
                                        <span className="text-[11px] font-semibold text-secondary bg-surface-container px-2 py-0.5 rounded-md">
                                            {schedule.room}
                                        </span>
                                    )}
                                    {schedule.lecturer && (
                                        <span className="flex items-center gap-1 text-[11px] text-secondary font-medium truncate">
                                            <User className="w-3 h-3" /> {schedule.lecturer}
                                        </span>
                                    )}
                                </div>

                                {/* Info Target Materi */}
                                <div className="bg-surface-container-low border border-surface-variant rounded-[16px] p-3 mb-2">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-[10px] font-bold text-primary uppercase tracking-wider flex items-center gap-1">
                                            <Sparkles className="w-3 h-3" /> Target Belajar:
                                        </span>
                                        {activeModule?.is_completed && (
                                            <span className="text-[10px] font-bold text-mint-fg flex items-center gap-0.5">
                                                <CheckCircle2 className="w-3 h-3" /> Selesai
                                            </span>
                                        )}
                                    </div>

                                    {schedule.target_material ? (
                                        <div>
                                            <p className="font-bold text-xs text-on-surface line-clamp-1">
                                                {schedule.target_material}
                                            </p>
                                            {activeModule && (
                                                <p className="text-[11px] text-secondary mt-0.5 truncate">
                                                    Modul: {activeModule.module_title}
                                                </p>
                                            )}
                                        </div>
                                    ) : activeModule ? (
                                        <div>
                                            <p className="font-bold text-xs text-on-surface line-clamp-1">
                                                {activeModule.kb_title}
                                            </p>
                                            <p className="text-[11px] text-secondary mt-0.5 truncate">
                                                {activeModule.module_title}
                                            </p>
                                        </div>
                                    ) : (
                                        <p className="text-[11px] text-secondary italic">
                                            Belum ditentukan materi spesifik
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Tombol Mulai Belajar */}
                            {activeModule ? (
                                <Link
                                    href={`/academic/${activeModule.id}`}
                                    className={`mt-3 w-full py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] ${
                                        isYesterday
                                            ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-xs'
                                            : 'bg-primary/10 hover:bg-primary/20 text-primary'
                                    }`}
                                >
                                    <span>
                                        {isYesterday ? 'Selesaikan Kuis Kemarin' : 'Mulai Belajar & Kuis'}
                                    </span>
                                    <ChevronRight className="w-3.5 h-3.5" />
                                </Link>
                            ) : (
                                <Link
                                    href="/academic"
                                    className="mt-3 w-full py-2 px-3 bg-surface-container hover:bg-surface-container-high text-secondary rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all"
                                >
                                    <span>Kelola Materi</span>
                                    <ChevronRight className="w-3.5 h-3.5" />
                                </Link>
                            )}
                        </div>
                    );
                })}

                {/* 2. KARTU KOTAK TUNGGAKAN (SEUKURAN DENGAN JADWAL LAIN, MINIMALIS & KLIK UNTUK BUKA) */}
                {backlogSchedules.length > 0 && (
                    <div
                        onClick={() => setIsBacklogModalOpen(true)}
                        className="rounded-[24px] p-5 sm:p-6 shadow-xs flex flex-col justify-between border min-h-[220px] transition-all bg-amber-500/5 border-amber-400/40 ring-1 ring-amber-400/20 cursor-pointer hover:border-amber-400 hover:bg-amber-500/10 group"
                    >
                        <div>
                            {/* Header: Badge & Status */}
                            <div className="flex justify-between items-center mb-3">
                                <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider bg-amber-500 text-white flex items-center gap-1 shadow-xs">
                                    <AlertTriangle className="w-3 h-3" /> Tunggakan Kuis
                                </span>
                                <span className="text-xs font-extrabold text-amber-800 bg-amber-100/90 px-2.5 py-0.5 rounded-full">
                                    {backlogSchedules.length} Materi
                                </span>
                            </div>

                            {/* Judul & Counter Besar */}
                            <div className="my-2">
                                <h4 className="text-2xl font-extrabold text-on-surface tracking-tight mb-1">
                                    {backlogSchedules.length} Tunggakan
                                </h4>
                                <p className="text-xs text-secondary leading-relaxed">
                                    Ada {backlogSchedules.length} materi kuis dari jadwal lampau yang belum kamu selesaikan. Klik untuk melihat daftar & mulai mengerjakan.
                                </p>
                            </div>
                        </div>

                        {/* Tombol Aksi di Bawah Kartu */}
                        <div className="mt-4 w-full py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all bg-amber-500 text-white shadow-xs group-hover:bg-amber-600">
                            <Layers className="w-3.5 h-3.5" />
                            <span>Buka Daftar Tunggakan ({backlogSchedules.length})</span>
                            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                    </div>
                )}

                {/* KONDISI STATE KOSONG */}
                {activeFocusSchedules.length === 0 && backlogSchedules.length === 0 && (
                    <div className="col-span-full bg-surface-bright border border-surface-variant rounded-[24px] p-6 text-center">
                        <CheckCircle2 className="w-8 h-8 text-mint-fg mx-auto mb-2 opacity-80" />
                        <p className="text-sm font-bold text-on-surface">Semua Beres! Tidak Ada Jadwal Aktif</p>
                        <p className="text-xs text-secondary mt-0.5">
                            Hari ini tidak ada jadwal belajar mandiri, dan semua materi lampau sudah kamu selesaikan.
                        </p>
                    </div>
                )}
            </div>

            {/* MODAL POPUP DETAIL DAFTAR TUNGGAKAN (DIBUKA SAAT KARTU DIKLIK) */}
            {isBacklogModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
                    <div className="bg-surface w-full max-w-lg rounded-t-[28px] sm:rounded-[28px] p-6 pb-28 sm:pb-6 shadow-2xl max-h-[88dvh] overflow-y-auto border border-surface-variant flex flex-col">
                        {/* Header Modal */}
                        <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600">
                                    <AlertTriangle className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-extrabold text-on-surface">
                                        Daftar Tunggakan Kuis
                                    </h3>
                                    <p className="text-xs text-secondary">
                                        {backlogSchedules.length} materi lampau yang belum selesai
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsBacklogModalOpen(false)}
                                className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-secondary hover:text-on-surface"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* List Materi yang Tertunggak */}
                        <div className="flex flex-col gap-3 mb-5">
                            {backlogSchedules.map((item) => {
                                const mod = getActiveModule(item);
                                return (
                                    <div
                                        key={`modal-backlog-${item.id}`}
                                        className="bg-surface-container-low border border-surface-variant rounded-2xl p-4 flex items-center justify-between gap-3"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                                                    Jadwal {DAY_NAMES[item.day_of_week]}
                                                </span>
                                                <span className="text-xs text-secondary font-medium">
                                                    {item.start_time.slice(0, 5)}
                                                </span>
                                            </div>
                                            <h5 className="font-extrabold text-sm text-on-surface truncate">
                                                {item.subject_name}
                                            </h5>
                                            {mod ? (
                                                <p className="text-xs text-secondary truncate mt-0.5">
                                                    {mod.kb_title} ({mod.module_title})
                                                </p>
                                            ) : item.target_material ? (
                                                <p className="text-xs text-primary font-medium truncate mt-0.5">
                                                    Target: {item.target_material}
                                                </p>
                                            ) : null}
                                        </div>

                                        {mod ? (
                                            <Link
                                                href={`/academic/${mod.id}`}
                                                className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shrink-0 shadow-xs flex items-center gap-1 active:scale-95 transition-all"
                                            >
                                                <span>Kerjakan</span>
                                                <ChevronRight className="w-3.5 h-3.5" />
                                            </Link>
                                        ) : (
                                            <Link
                                                href="/academic"
                                                className="px-3.5 py-2 bg-surface-container hover:bg-surface-container-high text-secondary rounded-xl text-xs font-bold shrink-0"
                                            >
                                                Materi
                                            </Link>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Tombol Tutup Modal */}
                        <button
                            onClick={() => setIsBacklogModalOpen(false)}
                            className="w-full bg-surface-container hover:bg-surface-container-high text-on-surface py-3 rounded-full font-bold text-sm transition-all"
                        >
                            Tutup
                        </button>
                    </div>
                </div>
            )}

            {/* MODAL / DRAWER KELOLA SEMUA JADWAL MINGGUAN */}
            {isAllSchedulesModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
                    <div className="bg-surface w-full max-w-2xl rounded-t-[28px] sm:rounded-[28px] p-6 pb-28 sm:pb-6 shadow-2xl max-h-[88dvh] overflow-y-auto border border-surface-variant flex flex-col">
                        <div className="flex justify-between items-center mb-5">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                                    <Calendar className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-extrabold text-on-surface">Seluruh Jadwal Mingguan</h2>
                                    <p className="text-xs text-secondary mt-0.5">Kelola, edit, atau hapus jadwal belajar mandiri</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsAllSchedulesModalOpen(false)}
                                className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-secondary hover:text-on-surface"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="flex flex-col gap-3 mb-4">
                            {schedules.map((schedule) => {
                                const activeModule = getActiveModule(schedule);
                                return (
                                    <div
                                        key={`all-${schedule.id}`}
                                        className="bg-surface-container-low border border-surface-variant rounded-2xl p-4 flex items-center justify-between gap-3"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[10px] font-extrabold px-2 py-0.5 bg-primary/10 text-primary rounded-full uppercase">
                                                    {DAY_NAMES[schedule.day_of_week]}
                                                </span>
                                                <span className="text-xs font-bold text-secondary">
                                                    {schedule.start_time.slice(0, 5)} - {schedule.end_time.slice(0, 5)}
                                                </span>
                                                {schedule.room && (
                                                    <span className="text-[10px] bg-surface-container px-2 py-0.5 rounded-md text-secondary">
                                                        {schedule.room}
                                                    </span>
                                                )}
                                            </div>
                                            <h4 className="font-extrabold text-sm text-on-surface truncate">
                                                {schedule.subject_name}
                                            </h4>
                                            {schedule.target_material ? (
                                                <p className="text-xs text-primary font-medium truncate">
                                                    Target: {schedule.target_material}
                                                </p>
                                            ) : activeModule ? (
                                                <p className="text-xs text-secondary truncate">
                                                    {activeModule.kb_title}
                                                </p>
                                            ) : null}
                                        </div>

                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <button
                                                onClick={() => {
                                                    setIsAllSchedulesModalOpen(false);
                                                    setEditingSchedule(schedule);
                                                }}
                                                className="w-8 h-8 rounded-xl bg-surface hover:bg-surface-container flex items-center justify-center text-secondary hover:text-primary transition-colors border border-surface-variant"
                                                title="Edit Jadwal"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(schedule.id, schedule.subject_name)}
                                                disabled={isPending}
                                                className="w-8 h-8 rounded-xl bg-surface hover:bg-red-50 flex items-center justify-center text-secondary hover:text-danger transition-colors border border-surface-variant"
                                                title="Hapus Jadwal"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <button
                            onClick={() => setIsAllSchedulesModalOpen(false)}
                            className="w-full bg-surface-container hover:bg-surface-container-high text-on-surface py-3 rounded-full font-bold text-sm transition-all"
                        >
                            Tutup
                        </button>
                    </div>
                </div>
            )}

            {/* Modal Edit */}
            {editingSchedule && (
                <EditCourseScheduleModal
                    schedule={editingSchedule}
                    availableModules={modules}
                    isOpen={true}
                    onClose={() => setEditingSchedule(null)}
                />
            )}
        </div>
    );
}
