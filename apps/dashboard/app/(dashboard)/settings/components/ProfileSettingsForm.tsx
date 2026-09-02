'use client';

import { useState, useTransition } from 'react';
import { User, Mail, Phone, Check, Loader2, Sparkles } from 'lucide-react';
import { updateProfile } from '../actions';

interface ProfileSettingsFormProps {
    initialName: string;
    email: string;
    phoneNumber: string;
}

export default function ProfileSettingsForm({ initialName, email, phoneNumber }: ProfileSettingsFormProps) {
    const [name, setName] = useState(initialName || '');
    const [isPending, startTransition] = useTransition();
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setSuccessMessage('');
        setErrorMessage('');

        startTransition(async () => {
            try {
                await updateProfile(name);
                setSuccessMessage('Nama profil berhasil disimpan!');
                setTimeout(() => setSuccessMessage(''), 3000);
            } catch (err: any) {
                setErrorMessage(err?.message || 'Gagal menyimpan profil');
            }
        });
    };

    return (
        <div className="bg-surface-bright border border-surface-variant rounded-[24px] p-6 shadow-[0_8px_24px_rgba(24,26,42,0.04)]">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <User className="w-6 h-6" />
                </div>
                <div>
                    <h2 className="text-lg font-bold text-on-surface">Profil & Asisten</h2>
                    <p className="text-xs text-secondary">Informasi akun dan koneksi WhatsApp Karen</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {/* Status Bot Karen */}
                <div className="flex items-center justify-between p-3.5 bg-surface-container-low rounded-2xl border border-surface-variant/50">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-mint-bg flex items-center justify-center text-mint-fg flex-shrink-0">
                            <Sparkles className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-on-surface">Asisten Karen</p>
                            <p className="text-[11px] text-mint-fg font-semibold">Tersambung & Aktif</p>
                        </div>
                    </div>
                    <span className="text-[10px] bg-mint-bg text-mint-fg font-bold px-2.5 py-1 rounded-full">
                        Online
                    </span>
                </div>

                {/* Email */}
                <div>
                    <label className="text-xs font-bold text-secondary mb-1.5 flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5" /> Email Akun
                    </label>
                    <input
                        type="email"
                        disabled
                        value={email}
                        className="w-full bg-surface-container border border-surface-variant rounded-xl px-4 py-3 text-secondary text-sm cursor-not-allowed"
                    />
                </div>

                {/* Nomor WhatsApp */}
                <div>
                    <label className="text-xs font-bold text-secondary mb-1.5 flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5" /> Nomor WhatsApp Terdaftar
                    </label>
                    <input
                        type="text"
                        disabled
                        value={phoneNumber || 'Belum terhubung'}
                        className="w-full bg-surface-container border border-surface-variant rounded-xl px-4 py-3 text-secondary text-sm cursor-not-allowed"
                    />
                    <p className="text-[11px] text-secondary mt-1">
                        Nomor ini digunakan oleh bot Karen untuk memproses pesan dan mengirimkan briefing harian.
                    </p>
                </div>

                {/* Nama Lengkap */}
                <div>
                    <label className="text-xs font-bold text-secondary mb-1.5 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5" /> Nama Panggilan / Display Name
                    </label>
                    <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Nama kamu..."
                        className="w-full bg-surface border border-surface-variant rounded-xl px-4 py-3 text-on-surface text-sm focus:outline-none focus:border-primary transition-colors"
                    />
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
                    className="w-full bg-primary hover:bg-primary-container text-on-primary py-3 rounded-full font-bold text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2 mt-2 shadow-[0_4px_16px_rgba(56,74,216,0.25)]"
                >
                    {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> Simpan Perubahan</>}
                </button>
            </form>
        </div>
    );
}
