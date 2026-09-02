'use client';

import { useState, useTransition } from 'react';
import { Shirt, Clock, Check, Loader2, Sparkles } from 'lucide-react';
import { updateWorkRoutines } from '../actions';

interface RoutineSettingsFormProps {
    initialUniforms: Record<string, string>;
    initialStoryTime: string;
}

const DAYS = [
    { id: '1', name: 'Senin', default: 'Batik' },
    { id: '2', name: 'Selasa', default: 'Kemeja' },
    { id: '3', name: 'Rabu', default: 'Bebas Rapi' },
    { id: '4', name: 'Kamis', default: 'Batik' },
    { id: '5', name: 'Jumat', default: 'Kaos Polo' },
    { id: '6', name: 'Sabtu', default: 'Bebas Rapi' },
];

const PRESET_UNIFORMS = [
    'Batik',
    'Kemeja',
    'Kaos Polo',
    'Bebas Rapi',
    'Kaos Hitam',
    'Baju Olahraga',
    'Seragam Khusus'
];

export default function RoutineSettingsForm({ initialUniforms, initialStoryTime }: RoutineSettingsFormProps) {
    const [uniforms, setUniforms] = useState<Record<string, string>>({
        '1': initialUniforms?.['1'] || 'Batik',
        '2': initialUniforms?.['2'] || 'Kemeja',
        '3': initialUniforms?.['3'] || 'Bebas Rapi',
        '4': initialUniforms?.['4'] || 'Batik',
        '5': initialUniforms?.['5'] || 'Kaos Polo',
        '6': initialUniforms?.['6'] || 'Bebas Rapi',
    });

    const [storyTime, setStoryTime] = useState(
        initialStoryTime ? initialStoryTime.slice(0, 5) : '15:30'
    );

    const [isPending, startTransition] = useTransition();
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    const handleUniformChange = (dayId: string, value: string) => {
        setUniforms(prev => ({ ...prev, [dayId]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setSuccessMessage('');
        setErrorMessage('');

        startTransition(async () => {
            try {
                const formattedTime = storyTime.length === 5 ? `${storyTime}:00` : storyTime;
                await updateWorkRoutines(uniforms, formattedTime);
                setSuccessMessage('Rutinitas kerja & seragam berhasil disimpan!');
                setTimeout(() => setSuccessMessage(''), 3000);
            } catch (err: any) {
                setErrorMessage(err?.message || 'Gagal menyimpan rutinitas');
            }
        });
    };

    return (
        <div className="bg-surface-bright border border-surface-variant rounded-[24px] p-6 shadow-[0_8px_24px_rgba(24,26,42,0.04)]">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-peach-bg flex items-center justify-center text-peach-fg">
                    <Shirt className="w-6 h-6" />
                </div>
                <div>
                    <h2 className="text-lg font-bold text-on-surface">Rutinitas Kerja & Seragam</h2>
                    <p className="text-xs text-secondary">Otomatis dibacakan Karen di Daily Briefing WhatsApp setiap 06:00 WIB</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                {/* Jadwal Seragam 6 Hari */}
                <div>
                    <label className="text-xs font-bold text-secondary mb-3 block uppercase tracking-wider">
                        Seragam Kerja Mingguan (Senin - Sabtu)
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {DAYS.map(day => (
                            <div key={day.id} className="p-3 bg-surface-container-low rounded-2xl border border-surface-variant/40">
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-xs font-extrabold text-on-surface flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-primary" />
                                        {day.name}
                                    </span>
                                    <span className="text-[10px] text-secondary font-medium">Hari Kerja</span>
                                </div>

                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        required
                                        value={uniforms[day.id] || ''}
                                        onChange={(e) => handleUniformChange(day.id, e.target.value)}
                                        placeholder={`Contoh: ${day.default}`}
                                        className="w-full bg-surface border border-surface-variant rounded-xl px-3 py-2 text-xs font-semibold text-on-surface focus:outline-none focus:border-primary"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Jam Pengingat Story IG */}
                <div className="p-4 bg-surface-container-low rounded-2xl border border-surface-variant/50">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <p className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                                <Clock className="w-4 h-4 text-primary" /> Jam Reminder Story Medsos
                            </p>
                            <p className="text-[11px] text-secondary mt-0.5">
                                Karen akan mengingatkan departemen giliran story IG (Senin–Sabtu).
                            </p>
                        </div>
                        <input
                            type="time"
                            required
                            value={storyTime}
                            onChange={(e) => setStoryTime(e.target.value)}
                            className="bg-surface border border-surface-variant rounded-xl px-3 py-2 text-sm font-bold text-on-surface focus:outline-none focus:border-primary w-32 text-center self-start sm:self-auto"
                        />
                    </div>
                </div>

                {/* Quick Presets Info */}
                <div className="flex items-center gap-2 text-xs text-secondary bg-surface-container-lowest p-3 rounded-xl border border-surface-variant/30">
                    <Sparkles className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    <span>
                        Kamu juga tetap bisa ubah seragam kapan saja lewat chat WhatsApp (misal: <em>"Karen, ganti seragam rabu jadi batik"</em>).
                    </span>
                </div>

                {/* Feedback Message */}
                {successMessage && (
                    <div className="p-3 bg-mint-bg/30 text-mint-fg rounded-xl text-xs font-bold flex items-center gap-2">
                        <Check className="w-4 h-4" /> {successMessage}
                    </div>
                )}
                {errorMessage && (
                    <div className="p-3 bg-red-50 text-danger rounded-xl text-xs font-bold">
                        {errorMessage}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={isPending}
                    className="w-full bg-primary hover:bg-primary-container text-on-primary py-3 rounded-full font-bold text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(56,74,216,0.25)]"
                >
                    {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> Simpan Rutinitas</>}
                </button>
            </form>
        </div>
    );
}
