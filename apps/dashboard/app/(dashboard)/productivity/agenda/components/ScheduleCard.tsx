'use client';

import { useState, useTransition } from 'react';
import { Clock, Edit2, Trash2 } from 'lucide-react';
import { deleteSchedule } from '../actions';
import EditScheduleModal from './EditScheduleModal';

interface Schedule {
    id: string;
    subject: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
}

export default function ScheduleCard({ schedule }: { schedule: Schedule }) {
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isPending, startTransition] = useTransition();

    const handleDelete = () => {
        if (!confirm(`Hapus jadwal "${schedule.subject}"?`)) return;

        startTransition(async () => {
            try {
                await deleteSchedule(schedule.id);
            } catch (err: any) {
                alert(err?.message || 'Gagal menghapus jadwal');
            }
        });
    };

    return (
        <>
            <div className="bg-surface-bright border border-surface-variant rounded-[20px] p-4 shadow-[0_8px_24px_rgba(24,26,42,0.04)] transition-all flex flex-col justify-between group">
                <div>
                    {/* Waktu & Aksi */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                            <Clock className="w-3.5 h-3.5" />
                            <span>
                                {schedule.start_time.slice(0, 5)} - {schedule.end_time.slice(0, 5)}
                            </span>
                        </div>

                        {/* Tombol Aksi */}
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setIsEditOpen(true)}
                                className="w-7 h-7 rounded-lg hover:bg-surface-container flex items-center justify-center text-secondary hover:text-primary transition-colors"
                                title="Edit Jadwal"
                            >
                                <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={isPending}
                                className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center text-secondary hover:text-danger transition-colors"
                                title="Hapus Jadwal"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>

                    {/* Judul Mata Kuliah / Kegiatan */}
                    <h4 className="font-bold text-sm text-on-surface leading-snug line-clamp-2">
                        {schedule.subject}
                    </h4>
                </div>
            </div>

            {/* Modal Edit */}
            {isEditOpen && (
                <EditScheduleModal
                    schedule={schedule}
                    isOpen={true}
                    onClose={() => setIsEditOpen(false)}
                />
            )}
        </>
    );
}
