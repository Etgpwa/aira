'use client';

import { useState, useTransition } from 'react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import {
    Bell,
    X,
    Plus,
    Clock,
    Calendar,
    CheckCircle2,
    Trash2,
    RotateCw,
    Loader2,
    Sun,
    Camera,
    CheckSquare,
    Sparkles,
    AlertCircle,
    ChevronDown,
    ChevronUp
} from 'lucide-react';
import {
    createCustomReminder,
    rescheduleReminder,
    deleteReminder,
    updateRoutineSettings
} from '@/app/(dashboard)/reminders/actions';

interface ReminderItem {
    id: string;
    message: string;
    remind_at: string;
    status: 'PENDING' | 'SENT' | 'CANCELLED';
    created_at?: string;
}

interface RoutineInfo {
    story_reminder_time?: string;
    uniform_today?: string;
}

interface ReminderHubModalProps {
    initialReminders?: ReminderItem[];
    routineInfo?: RoutineInfo;
}

export default function ReminderHubModal({
    initialReminders = [],
    routineInfo
}: ReminderHubModalProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'custom' | 'system'>('custom');

    // State Tambah Reminder Kustom
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [customMessage, setCustomMessage] = useState('');
    const [customRemindAt, setCustomRemindAt] = useState('');

    // State Reschedule
    const [reschedulingId, setReschedulingId] = useState<string | null>(null);
    const [newTime, setNewTime] = useState('');

    // State Edit Story Reminder Time
    const [storyTime, setStoryTime] = useState(
        routineInfo?.story_reminder_time?.slice(0, 5) || '15:30'
    );

    const [isPending, startTransition] = useTransition();
    const [statusFeedback, setStatusFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const pendingReminders = initialReminders.filter(r => r.status === 'PENDING');
    const sentReminders = initialReminders.filter(r => r.status === 'SENT');

    const handleCreateReminder = (e: React.FormEvent) => {
        e.preventDefault();
        setStatusFeedback(null);

        if (!customMessage.trim() || !customRemindAt) {
            setStatusFeedback({ type: 'error', text: 'Pesan dan waktu pengingat harus diisi' });
            return;
        }

        startTransition(async () => {
            try {
                await createCustomReminder({
                    message: customMessage.trim(),
                    remindAt: customRemindAt
                });

                setStatusFeedback({ type: 'success', text: 'Pengingat berhasil dibuat!' });
                setCustomMessage('');
                setCustomRemindAt('');
                setIsCreateOpen(false);
            } catch (err: any) {
                setStatusFeedback({ type: 'error', text: err?.message || 'Gagal membuat pengingat' });
            }
        });
    };

    const handleReschedule = (reminderId: string) => {
        if (!newTime) return;

        startTransition(async () => {
            try {
                await rescheduleReminder(reminderId, newTime);
                setStatusFeedback({ type: 'success', text: 'Waktu pengingat berhasil diubah!' });
                setReschedulingId(null);
                setNewTime('');
            } catch (err: any) {
                setStatusFeedback({ type: 'error', text: err?.message || 'Gagal mengubah waktu pengingat' });
            }
        });
    };

    const handleDelete = (reminderId: string) => {
        if (!confirm('Hapus pengingat ini?')) return;

        startTransition(async () => {
            try {
                await deleteReminder(reminderId);
                setStatusFeedback({ type: 'success', text: 'Pengingat dihapus' });
            } catch (err: any) {
                setStatusFeedback({ type: 'error', text: err?.message || 'Gagal menghapus pengingat' });
            }
        });
    };

    const handleSaveStoryTime = () => {
        startTransition(async () => {
            try {
                await updateRoutineSettings({ storyReminderTime: storyTime });
                setStatusFeedback({ type: 'success', text: 'Jam pengingat story IG berhasil disimpan!' });
            } catch (err: any) {
                setStatusFeedback({ type: 'error', text: err?.message || 'Gagal menyimpan pengaturan' });
            }
        });
    };

    return (
        <>
            {/* Trigger Button: Icon Lonceng Header */}
            <button
                onClick={() => {
                    setIsOpen(true);
                    setStatusFeedback(null);
                }}
                className="w-10 h-10 rounded-full bg-surface-container hover:bg-surface-container-high transition-all flex items-center justify-center text-primary relative active:scale-95 shadow-sm"
                title="Pusat Pengingat & Notifikasi"
            >
                <Bell className="w-5 h-5" />
                {pendingReminders.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-danger text-white text-[10px] font-extrabold w-5 h-5 rounded-full flex items-center justify-center border-2 border-surface shadow-sm">
                        {pendingReminders.length}
                    </span>
                )}
            </button>

            {/* Modal Dialog */}
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
                    <div className="bg-surface w-full max-w-lg rounded-t-[28px] sm:rounded-[28px] p-6 pb-28 sm:pb-6 shadow-2xl max-h-[88dvh] overflow-y-auto border border-surface-variant flex flex-col">
                        {/* Header Modal */}
                        <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                                    <Bell className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-extrabold text-on-surface">Pusat Pengingat</h2>
                                    <p className="text-xs text-secondary mt-0.5">Atur pesan pengingat & rutinitas Karen</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-secondary hover:text-on-surface"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Tab Switcher */}
                        <div className="flex bg-surface-container p-1 rounded-2xl mb-4">
                            <button
                                onClick={() => setActiveTab('custom')}
                                className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                                    activeTab === 'custom'
                                        ? 'bg-surface text-primary shadow-sm'
                                        : 'text-secondary hover:text-on-surface'
                                }`}
                            >
                                <Clock className="w-3.5 h-3.5" /> Pengingat Kustom ({pendingReminders.length})
                            </button>
                            <button
                                onClick={() => setActiveTab('system')}
                                className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                                    activeTab === 'system'
                                        ? 'bg-surface text-primary shadow-sm'
                                        : 'text-secondary hover:text-on-surface'
                                }`}
                            >
                                <Sparkles className="w-3.5 h-3.5" /> Rutinitas Sistem
                            </button>
                        </div>

                        {/* Feedback Banner */}
                        {statusFeedback && (
                            <div
                                className={`p-3 rounded-xl text-xs font-bold mb-4 flex items-center gap-2 ${
                                    statusFeedback.type === 'success'
                                        ? 'bg-mint-bg/30 text-mint-fg'
                                        : 'bg-red-50 text-danger'
                                }`}
                            >
                                {statusFeedback.type === 'success' ? (
                                    <CheckCircle2 className="w-4 h-4" />
                                ) : (
                                    <AlertCircle className="w-4 h-4" />
                                )}
                                {statusFeedback.text}
                            </div>
                        )}

                        {/* ──────────────────────────────────────────────────────── */}
                        {/* TAB 1: PENGINGAT KUSTOM & AKTIF */}
                        {/* ──────────────────────────────────────────────────────── */}
                        {activeTab === 'custom' && (
                            <div className="flex flex-col gap-4">
                                {/* Accordion Buat Pengingat Baru */}
                                <div className="bg-surface-bright border border-surface-variant rounded-2xl overflow-hidden">
                                    <button
                                        onClick={() => setIsCreateOpen(!isCreateOpen)}
                                        className="w-full px-4 py-3.5 flex items-center justify-between font-bold text-xs text-primary bg-primary/5 hover:bg-primary/10 transition-colors"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Plus className="w-4 h-4" />
                                            <span>+ Buat Pengingat Teks Bebas Baru</span>
                                        </div>
                                        {isCreateOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                    </button>

                                    {isCreateOpen && (
                                        <form onSubmit={handleCreateReminder} className="p-4 flex flex-col gap-3 border-t border-surface-variant">
                                            <div>
                                                <label className="text-xs font-bold text-secondary mb-1 block">
                                                    Pesan Pengingat (Custom Text) *
                                                </label>
                                                <input
                                                    type="text"
                                                    required
                                                    value={customMessage}
                                                    onChange={(e) => setCustomMessage(e.target.value)}
                                                    placeholder="Contoh: Telepon dosen, Minum obat, Bayar tagihan"
                                                    className="w-full bg-surface-container border border-surface-variant rounded-xl px-3.5 py-2.5 text-on-surface text-sm font-semibold focus:outline-none focus:border-primary"
                                                />
                                            </div>

                                            <div>
                                                <label className="text-xs font-bold text-secondary mb-1 block">
                                                    Waktu Diingatkan *
                                                </label>
                                                <input
                                                    type="datetime-local"
                                                    required
                                                    value={customRemindAt}
                                                    onChange={(e) => setCustomRemindAt(e.target.value)}
                                                    className="w-full bg-surface-container border border-surface-variant rounded-xl px-3.5 py-2.5 text-on-surface text-sm font-semibold focus:outline-none focus:border-primary"
                                                />
                                            </div>

                                            <button
                                                type="submit"
                                                disabled={isPending}
                                                className="w-full py-2.5 bg-primary hover:bg-primary-container text-on-primary rounded-xl font-bold text-xs transition-all active:scale-95 flex items-center justify-center gap-2 mt-1 shadow-sm"
                                            >
                                                {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Plus className="w-3.5 h-3.5" /> Simpan Pengingat</>}
                                            </button>
                                        </form>
                                    )}
                                </div>

                                {/* List Pengingat Mendatang (PENDING) */}
                                <div>
                                    <h3 className="text-xs font-bold text-secondary uppercase tracking-wider mb-2">
                                        Pengingat Mendatang ({pendingReminders.length})
                                    </h3>

                                    {pendingReminders.length === 0 ? (
                                        <div className="border border-dashed border-surface-variant rounded-2xl p-6 text-center text-secondary text-xs">
                                            Tidak ada pengingat yang menunggu
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-2.5">
                                            {pendingReminders.map((r) => (
                                                <div
                                                    key={r.id}
                                                    className="bg-surface-bright border border-surface-variant rounded-2xl p-3.5 flex flex-col gap-2 shadow-sm"
                                                >
                                                    <div className="flex justify-between items-start gap-2">
                                                        <p className="font-bold text-sm text-on-surface leading-snug flex-1">
                                                            {r.message}
                                                        </p>
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            <button
                                                                onClick={() => {
                                                                    setReschedulingId(reschedulingId === r.id ? null : r.id);
                                                                    setNewTime(
                                                                        new Date(r.remind_at).toISOString().slice(0, 16)
                                                                    );
                                                                }}
                                                                className="p-1.5 text-secondary hover:text-primary hover:bg-surface-container rounded-lg transition-colors"
                                                                title="Reschedule / Ubah Jam"
                                                            >
                                                                <RotateCw className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete(r.id)}
                                                                className="p-1.5 text-secondary hover:text-danger hover:bg-red-50 rounded-lg transition-colors"
                                                                title="Batal / Hapus"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-1.5 text-xs text-primary font-semibold">
                                                        <Clock className="w-3.5 h-3.5" />
                                                        <span>
                                                            {format(new Date(r.remind_at), 'dd MMM yyyy, HH:mm', { locale: id })}
                                                        </span>
                                                    </div>

                                                    {/* Form Reschedule Inline */}
                                                    {reschedulingId === r.id && (
                                                        <div className="mt-2 pt-2 border-t border-surface-variant flex items-center gap-2">
                                                            <input
                                                                type="datetime-local"
                                                                value={newTime}
                                                                onChange={(e) => setNewTime(e.target.value)}
                                                                className="flex-1 bg-surface-container border border-surface-variant rounded-lg px-2.5 py-1.5 text-xs font-semibold text-on-surface"
                                                            />
                                                            <button
                                                                onClick={() => handleReschedule(r.id)}
                                                                disabled={isPending}
                                                                className="px-3 py-1.5 bg-primary text-on-primary rounded-lg text-xs font-bold shrink-0"
                                                            >
                                                                Simpan
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Riwayat Pengingat Terkirim (SENT) */}
                                {sentReminders.length > 0 && (
                                    <div className="mt-2">
                                        <h3 className="text-xs font-bold text-secondary uppercase tracking-wider mb-2">
                                            Riwayat Terkirim ({sentReminders.length})
                                        </h3>
                                        <div className="flex flex-col gap-2 max-h-40 overflow-y-auto">
                                            {sentReminders.map((r) => (
                                                <div
                                                    key={r.id}
                                                    className="bg-surface-container-low p-2.5 rounded-xl flex items-center justify-between text-xs opacity-75"
                                                >
                                                    <span className="line-through text-secondary line-clamp-1 flex-1">
                                                        {r.message}
                                                    </span>
                                                    <span className="text-[10px] text-secondary font-medium ml-2">
                                                        {format(new Date(r.remind_at), 'dd/MM HH:mm')}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ──────────────────────────────────────────────────────── */}
                        {/* TAB 2: PENGINGAT RUTIN SISTEM */}
                        {/* ──────────────────────────────────────────────────────── */}
                        {activeTab === 'system' && (
                            <div className="flex flex-col gap-3">
                                {/* 1. Daily Briefing */}
                                <div className="bg-surface-bright border border-surface-variant rounded-2xl p-4">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                                            <Sun className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between">
                                                <h4 className="font-bold text-sm text-on-surface">Daily Briefing Pagi</h4>
                                                <span className="text-[10px] font-extrabold px-2 py-0.5 bg-mint-bg text-mint-fg rounded-full">
                                                    Aktif (06:00 WIB)
                                                </span>
                                            </div>
                                            <p className="text-xs text-secondary mt-0.5">
                                                Ringkasan seragam kerja, jadwal kuliah, & tugas hari ini via WA.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* 2. Reminder Story Medsos */}
                                <div className="bg-surface-bright border border-surface-variant rounded-2xl p-4">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-9 h-9 rounded-xl bg-pink-500/10 text-pink-600 flex items-center justify-center">
                                            <Camera className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="font-bold text-sm text-on-surface">Pengingat Story Instagram</h4>
                                            <p className="text-xs text-secondary mt-0.5">
                                                Pengingat giliran departemen konten medsos (Senin–Sabtu).
                                            </p>
                                        </div>
                                    </div>

                                    {/* Edit Jam Story Inline */}
                                    <div className="flex items-center gap-2 pt-2 border-t border-surface-variant">
                                        <span className="text-xs font-bold text-secondary">Jam Pengingat:</span>
                                        <input
                                            type="time"
                                            value={storyTime}
                                            onChange={(e) => setStoryTime(e.target.value)}
                                            className="bg-surface-container border border-surface-variant rounded-lg px-2.5 py-1 text-xs font-bold text-on-surface"
                                        />
                                        <button
                                            onClick={handleSaveStoryTime}
                                            disabled={isPending}
                                            className="px-3 py-1 bg-primary text-on-primary rounded-lg text-xs font-bold ml-auto"
                                        >
                                            Simpan
                                        </button>
                                    </div>
                                </div>

                                {/* 3. Smart Task Reminder */}
                                <div className="bg-surface-bright border border-surface-variant rounded-2xl p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                                            <CheckSquare className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between">
                                                <h4 className="font-bold text-sm text-on-surface">Pengingat Tenggat Tugas</h4>
                                                <span className="text-[10px] font-extrabold px-2 py-0.5 bg-mint-bg text-mint-fg rounded-full">
                                                    Auto H-3 & H-1 Jam
                                                </span>
                                            </div>
                                            <p className="text-xs text-secondary mt-0.5">
                                                Bot otomatis mengingatkan tugas Kanban sebelum tenggat waktu.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* 4. Agenda Schedule Reminder */}
                                <div className="bg-surface-bright border border-surface-variant rounded-2xl p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
                                            <Calendar className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between">
                                                <h4 className="font-bold text-sm text-on-surface">Pengingat Jadwal Kuliah</h4>
                                                <span className="text-[10px] font-extrabold px-2 py-0.5 bg-mint-bg text-mint-fg rounded-full">
                                                    Auto H-30 Menit
                                                </span>
                                            </div>
                                            <p className="text-xs text-secondary mt-0.5">
                                                Bot otomatis mengirimkan alert sebelum jam kelas dimulai.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
