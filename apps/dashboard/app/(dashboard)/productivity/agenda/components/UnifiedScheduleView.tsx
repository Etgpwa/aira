'use client';

import { useState } from 'react';
import {
    GraduationCap,
    HeartPulse,
    Calendar,
    Clock,
    BookOpen,
    User,
    ChevronRight,
    Plus,
    Eye,
    EyeOff,
    RotateCcw
} from 'lucide-react';
import Link from 'next/link';
import ScheduleCard from './ScheduleCard';
import AddScheduleModal from './AddScheduleModal';
import AddCourseScheduleModal from '@/app/(dashboard)/academic/components/AddCourseScheduleModal';

const DAYS = [
    { id: 1, name: 'Senin', short: 'Sen' },
    { id: 2, name: 'Selasa', short: 'Sel' },
    { id: 3, name: 'Rabu', short: 'Rab' },
    { id: 4, name: 'Kamis', short: 'Kam' },
    { id: 5, name: 'Jumat', short: 'Jum' },
    { id: 6, name: 'Sabtu', short: 'Sab' },
    { id: 0, name: 'Minggu', short: 'Min' }
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

interface TherapySchedule {
    id: string;
    department: 'TSD' | 'OT';
    day_of_week: number;
    session_number: number;
    time_range: string;
    child_name: string;
    therapist_initial?: string | null;
}

interface StudySchedule {
    id: string;
    subject: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
}

interface UnifiedScheduleViewProps {
    studySchedules: StudySchedule[];
    courseSchedules: CourseSchedule[];
    courseModules: ModuleItem[];
    therapySchedules: TherapySchedule[];
}

export default function UnifiedScheduleView({
    studySchedules,
    courseSchedules,
    courseModules,
    therapySchedules
}: UnifiedScheduleViewProps) {
    // State Filter: Kategori mana yang disembunyikan (Hide)
    const [hiddenCategories, setHiddenCategories] = useState<Set<'course' | 'therapy' | 'personal'>>(new Set());
    const currentDayId = new Date().getDay();

    const toggleCategory = (category: 'course' | 'therapy' | 'personal') => {
        setHiddenCategories((prev) => {
            const next = new Set(prev);
            if (next.has(category)) {
                next.delete(category);
            } else {
                next.add(category);
            }
            return next;
        });
    };

    const isCourseVisible = !hiddenCategories.has('course');
    const isTherapyVisible = !hiddenCategories.has('therapy');
    const isPersonalVisible = !hiddenCategories.has('personal');

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Filter Tabs & Action Buttons Bar (Standard PWA Blue & Clean) */}
            <div className="px-6 mb-4 flex flex-wrap lg:flex-nowrap items-center justify-between gap-3 shrink-0">
                {/* Toggle Kategori (Hide / Show) */}
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-bold text-secondary uppercase tracking-wider mr-1">
                        Filter:
                    </span>

                    {/* 1. Toggle Kuliah */}
                    <button
                        onClick={() => toggleCategory('course')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 ${
                            isCourseVisible
                                ? 'bg-primary/10 text-primary border border-primary/25 shadow-xs'
                                : 'bg-surface-container text-secondary/50 line-through opacity-50 border border-transparent'
                        }`}
                        title={isCourseVisible ? 'Klik untuk sembunyikan Kuliah' : 'Klik untuk tampilkan Kuliah'}
                    >
                        {isCourseVisible ? <Eye className="w-3.5 h-3.5 text-primary" /> : <EyeOff className="w-3.5 h-3.5" />}
                        <GraduationCap className="w-3.5 h-3.5" /> Kuliah ({courseSchedules.length})
                    </button>

                    {/* 2. Toggle Terapi */}
                    <button
                        onClick={() => toggleCategory('therapy')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 ${
                            isTherapyVisible
                                ? 'bg-primary/10 text-primary border border-primary/25 shadow-xs'
                                : 'bg-surface-container text-secondary/50 line-through opacity-50 border border-transparent'
                        }`}
                        title={isTherapyVisible ? 'Klik untuk sembunyikan Terapi' : 'Klik untuk tampilkan Terapi'}
                    >
                        {isTherapyVisible ? <Eye className="w-3.5 h-3.5 text-primary" /> : <EyeOff className="w-3.5 h-3.5" />}
                        <HeartPulse className="w-3.5 h-3.5" /> Terapi ({therapySchedules.length})
                    </button>

                    {/* 3. Toggle Rutinitas */}
                    <button
                        onClick={() => toggleCategory('personal')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 ${
                            isPersonalVisible
                                ? 'bg-primary/10 text-primary border border-primary/25 shadow-xs'
                                : 'bg-surface-container text-secondary/50 line-through opacity-50 border border-transparent'
                        }`}
                        title={isPersonalVisible ? 'Klik untuk sembunyikan Rutinitas' : 'Klik untuk tampilkan Rutinitas'}
                    >
                        {isPersonalVisible ? <Eye className="w-3.5 h-3.5 text-primary" /> : <EyeOff className="w-3.5 h-3.5" />}
                        <Calendar className="w-3.5 h-3.5" /> Rutinitas ({studySchedules.length})
                    </button>

                    {/* Tombol Tampilkan Semua jika ada yang disembunyikan */}
                    {hiddenCategories.size > 0 && (
                        <button
                            onClick={() => setHiddenCategories(new Set())}
                            className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold text-primary hover:text-primary-container bg-primary/10 hover:bg-primary/20 transition-all flex items-center gap-1 ml-1 active:scale-95"
                            title="Tampilkan semua kategori"
                        >
                            <RotateCcw className="w-3 h-3" /> Tampilkan Semua
                        </button>
                    )}
                </div>

                {/* Tombol Tambah Cepat (Standard PWA Blue Theme) */}
                <div className="flex items-center gap-2">
                    <AddCourseScheduleModal
                        availableModules={courseModules}
                        triggerButton={
                            <button className="text-xs font-bold bg-primary hover:bg-primary-container text-on-primary px-3.5 py-1.5 rounded-full flex items-center gap-1.5 transition-all active:scale-95 shadow-xs">
                                <Plus className="w-3.5 h-3.5" /> Jadwal Belajar
                            </button>
                        }
                    />
                    <AddScheduleModal
                        triggerButton={
                            <button className="text-xs font-bold bg-surface-container hover:bg-surface-container-high text-on-surface px-3.5 py-1.5 rounded-full flex items-center gap-1.5 transition-all active:scale-95 border border-surface-variant">
                                <Plus className="w-3.5 h-3.5" /> Agenda Pribadi
                            </button>
                        }
                    />
                </div>
            </div>

            {/* Scrollable Container (Horizontal Columns per Hari) */}
            <div className="flex-1 w-full overflow-x-auto snap-x snap-mandatory scrollbar-hide px-5">
                <div className="flex gap-4 h-full min-w-max pb-6">
                    {DAYS.map((day) => {
                        const isToday = day.id === currentDayId;

                        // Filter data per hari sesuai visibilitas
                        const dayCourses = isCourseVisible
                            ? courseSchedules.filter((c) => c.day_of_week === day.id)
                            : [];
                        const dayTherapies = isTherapyVisible
                            ? therapySchedules.filter((t) => t.day_of_week === day.id)
                            : [];
                        const dayStudies = isPersonalVisible
                            ? studySchedules.filter((s) => s.day_of_week === day.id)
                            : [];

                        const totalDayItems = dayCourses.length + dayTherapies.length + dayStudies.length;

                        return (
                            <div key={day.id} className="w-[320px] shrink-0 h-full flex flex-col snap-center">
                                {/* Header Kolom Hari */}
                                <div className="flex items-center justify-between mb-3 px-1 shrink-0">
                                    <div className="flex items-center gap-2">
                                        <div
                                            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                                                isToday
                                                    ? 'bg-primary text-white shadow-[0_2px_8px_rgba(56,74,216,0.3)]'
                                                    : 'bg-surface-container text-secondary'
                                            }`}
                                        >
                                            {day.short}
                                        </div>
                                        <div>
                                            <h2 className="text-sm font-bold text-on-surface flex items-center gap-1">
                                                {day.name}
                                                {isToday && (
                                                    <span className="text-[10px] text-primary font-bold bg-primary/10 px-2 py-0.5 rounded-full">
                                                        Hari ini
                                                    </span>
                                                )}
                                            </h2>
                                        </div>
                                    </div>
                                    <span className="text-xs text-secondary bg-surface-container px-2 py-0.5 rounded-full font-bold">
                                        {totalDayItems}
                                    </span>
                                </div>

                                {/* List Aktivitas Hari Ini */}
                                <div className="flex-1 overflow-y-auto scrollbar-hide pb-20 px-1 flex flex-col gap-3">
                                    {/* 1. JADWAL BELAJAR MANDIRI UT */}
                                    {dayCourses.map((course) => {
                                        const relatedModules = courseModules.filter(
                                            (m) =>
                                                m.subject_name.toLowerCase().includes(course.subject_name.toLowerCase()) ||
                                                course.subject_name.toLowerCase().includes(m.subject_name.toLowerCase())
                                        );
                                        const activeModule =
                                            (course.module_id && courseModules.find((m) => m.id === course.module_id)) ||
                                            relatedModules.find((m) => !m.is_completed) ||
                                            relatedModules[0];

                                        return (
                                            <div
                                                key={`course-${course.id}`}
                                                className="bg-surface-bright border border-primary/20 rounded-[20px] p-4 shadow-xs flex flex-col justify-between"
                                            >
                                                <div>
                                                    {/* Badge & Jam */}
                                                    <div className="flex justify-between items-center mb-2">
                                                        <span className="text-[10px] font-extrabold px-2.5 py-0.5 bg-primary/10 text-primary rounded-full uppercase tracking-wider flex items-center gap-1">
                                                            <GraduationCap className="w-3 h-3 text-primary" /> Belajar Mandiri
                                                        </span>
                                                        <span className="text-xs font-bold text-secondary flex items-center gap-1">
                                                            <Clock className="w-3 h-3 text-primary" />
                                                            {course.start_time.slice(0, 5)} - {course.end_time.slice(0, 5)}
                                                        </span>
                                                    </div>

                                                    {/* Nama Mata Kuliah */}
                                                    <h4 className="font-extrabold text-sm text-on-surface mb-1">
                                                        {course.subject_name}
                                                    </h4>

                                                    {/* Metode Belajar UT & Tutor */}
                                                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-secondary mb-2.5">
                                                        {course.room && (
                                                            <span className="bg-surface-container px-2 py-0.5 rounded-md font-medium">
                                                                {course.room}
                                                            </span>
                                                        )}
                                                        {course.lecturer && (
                                                            <span className="flex items-center gap-1 truncate font-medium">
                                                                <User className="w-3 h-3 text-secondary" /> {course.lecturer}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Info Target Materi / Modul Hari Ini */}
                                                    <div className="bg-surface-container-low border border-surface-variant rounded-[14px] p-2.5 mb-2">
                                                        <span className="text-[9px] font-bold text-primary uppercase tracking-wider block mb-0.5 flex items-center gap-1">
                                                            <BookOpen className="w-2.5 h-2.5 text-primary" /> Target Belajar Hari Ini:
                                                        </span>
                                                        {course.target_material ? (
                                                            <div>
                                                                <p className="font-bold text-xs text-on-surface">
                                                                    {course.target_material}
                                                                </p>
                                                                {activeModule && (
                                                                    <p className="text-[10px] text-secondary mt-0.5">
                                                                        Modul: {activeModule.module_title}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        ) : activeModule ? (
                                                            <div>
                                                                <p className="font-bold text-xs text-on-surface line-clamp-1">
                                                                    {activeModule.kb_title}
                                                                </p>
                                                                <p className="text-[10px] text-secondary">
                                                                    {activeModule.module_title}
                                                                </p>
                                                            </div>
                                                        ) : (
                                                            <p className="text-[10px] text-secondary italic">
                                                                Belum ada target materi spesifik
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Link ke Tab Kuliah */}
                                                {activeModule ? (
                                                    <Link
                                                        href={`/academic/${activeModule.id}`}
                                                        className="w-full py-1.5 px-2.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all active:scale-95"
                                                    >
                                                        <span>Buka Materi Kuliah</span>
                                                        <ChevronRight className="w-3 h-3" />
                                                    </Link>
                                                ) : (
                                                    <Link
                                                        href="/academic"
                                                        className="w-full py-1.5 px-2.5 bg-surface-container hover:bg-surface-container-high text-secondary rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all"
                                                    >
                                                        <span>Kelola di Tab Kuliah</span>
                                                        <ChevronRight className="w-3 h-3" />
                                                    </Link>
                                                )}
                                            </div>
                                        );
                                    })}

                                    {/* 2. JADWAL TERAPI ANAK (TSD & OT) - STANDAR BIRU PWA */}
                                    {dayTherapies.map((therapy) => (
                                        <div
                                            key={`therapy-${therapy.id}`}
                                            className="bg-surface-bright border border-surface-variant hover:border-primary/30 rounded-[20px] p-3.5 shadow-xs transition-colors"
                                        >
                                            <div className="flex justify-between items-center mb-1.5">
                                                <span className="text-[10px] font-extrabold px-2.5 py-0.5 bg-primary/10 text-primary rounded-full uppercase tracking-wider flex items-center gap-1">
                                                    <HeartPulse className="w-3 h-3 text-primary" /> Terapi {therapy.department}
                                                </span>
                                                <span className="text-xs font-bold text-secondary">
                                                    Sesi {therapy.session_number} • {therapy.time_range}
                                                </span>
                                            </div>
                                            <h4 className="font-extrabold text-sm text-on-surface">
                                                {therapy.child_name}
                                            </h4>
                                            {therapy.therapist_initial && (
                                                <p className="text-xs text-secondary mt-0.5 font-medium">
                                                    Terapis: <span className="font-bold text-primary">{therapy.therapist_initial}</span>
                                                </p>
                                            )}
                                        </div>
                                    ))}

                                    {/* 3. AGENDA & RUTINITAS PRIBADI */}
                                    {dayStudies.map((study) => (
                                        <ScheduleCard key={`study-${study.id}`} schedule={study} />
                                    ))}

                                    {/* STATE KOSONG */}
                                    {totalDayItems === 0 && (
                                        <div className="border-2 border-dashed border-surface-variant rounded-[20px] p-8 text-center text-secondary text-sm font-medium flex flex-col items-center justify-center gap-2">
                                            <p className="text-xs">
                                                {hiddenCategories.size > 0
                                                    ? 'Tidak ada agenda (sebagian difilter)'
                                                    : 'Tidak ada agenda'}
                                            </p>
                                            <AddScheduleModal
                                                defaultDayId={day.id}
                                                triggerButton={
                                                    <button className="text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-full flex items-center gap-1 mt-1 transition-colors">
                                                        <Plus className="w-3.5 h-3.5" /> Tambah Agenda
                                                    </button>
                                                }
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
