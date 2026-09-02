'use client';

import { useState } from 'react';
import { KeyRound, Eye, EyeOff, Check, Loader2, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function ChangePasswordForm({ userEmail }: { userEmail?: string }) {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const [isLoading, setIsLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    const supabase = createClient();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSuccessMessage('');
        setErrorMessage('');

        if (!currentPassword) {
            setErrorMessage('Kata sandi saat ini harus diisi');
            return;
        }

        if (newPassword.length < 6) {
            setErrorMessage('Kata sandi baru minimal 6 karakter');
            return;
        }

        if (newPassword !== confirmPassword) {
            setErrorMessage('Konfirmasi kata sandi tidak cocok');
            return;
        }

        setIsLoading(true);

        try {
            // 1. Dapatkan email user
            let email = userEmail;
            if (!email) {
                const { data: { user } } = await supabase.auth.getUser();
                email = user?.email || undefined;
            }

            if (!email) {
                setErrorMessage('Sesi akun tidak ditemukan. Silakan muat ulang.');
                setIsLoading(false);
                return;
            }

            // 2. Verifikasi kata sandi saat ini langsung via client Supabase Auth
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password: currentPassword
            });

            if (signInError) {
                if (signInError.message === 'Invalid login credentials') {
                    setErrorMessage('Kata sandi saat ini tidak valid / salah.');
                } else {
                    setErrorMessage(signInError.message || 'Gagal verifikasi kata sandi saat ini.');
                }
                setIsLoading(false);
                return;
            }

            // 3. Perbarui ke kata sandi baru
            const { error: updateError } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (updateError) {
                setErrorMessage(updateError.message || 'Gagal memperbarui kata sandi.');
                setIsLoading(false);
                return;
            }

            setSuccessMessage('Kata sandi berhasil diperbarui!');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setTimeout(() => setSuccessMessage(''), 4000);
        } catch (err: any) {
            setErrorMessage(err?.message || 'Terjadi kesalahan sistem.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-surface-bright border border-surface-variant rounded-[24px] p-6 shadow-[0_8px_24px_rgba(24,26,42,0.04)]">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                    <KeyRound className="w-6 h-6 text-primary" />
                </div>
                <div>
                    <h2 className="text-lg font-bold text-on-surface">Keamanan & Kata Sandi</h2>
                    <p className="text-xs text-secondary">Perbarui password akun dashboard kamu</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {/* 1. Kata Sandi Saat Ini */}
                <div>
                    <label className="text-xs font-bold text-secondary mb-1.5 block">Kata Sandi Saat Ini *</label>
                    <div className="relative">
                        <input
                            type={showCurrentPassword ? 'text' : 'password'}
                            required
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            placeholder="Masukkan password saat ini"
                            className="w-full bg-surface-container border border-surface-variant rounded-xl px-4 py-3 pr-11 text-on-surface text-sm font-semibold focus:outline-none focus:border-primary placeholder:text-outline transition-colors"
                        />
                        <button
                            type="button"
                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-secondary hover:text-on-surface p-1"
                            title={showCurrentPassword ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'}
                        >
                            {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                </div>

                {/* 2. Kata Sandi Baru */}
                <div>
                    <label className="text-xs font-bold text-secondary mb-1.5 block">Kata Sandi Baru *</label>
                    <div className="relative">
                        <input
                            type={showNewPassword ? 'text' : 'password'}
                            required
                            minLength={6}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Minimal 6 karakter"
                            className="w-full bg-surface-container border border-surface-variant rounded-xl px-4 py-3 pr-11 text-on-surface text-sm font-semibold focus:outline-none focus:border-primary placeholder:text-outline transition-colors"
                        />
                        <button
                            type="button"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-secondary hover:text-on-surface p-1"
                            title={showNewPassword ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'}
                        >
                            {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                </div>

                {/* 3. Konfirmasi Kata Sandi Baru */}
                <div>
                    <label className="text-xs font-bold text-secondary mb-1.5 block">Konfirmasi Kata Sandi Baru *</label>
                    <div className="relative">
                        <input
                            type={showConfirmPassword ? 'text' : 'password'}
                            required
                            minLength={6}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Ulangi kata sandi baru"
                            className="w-full bg-surface-container border border-surface-variant rounded-xl px-4 py-3 pr-11 text-on-surface text-sm font-semibold focus:outline-none focus:border-primary placeholder:text-outline transition-colors"
                        />
                        <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-secondary hover:text-on-surface p-1"
                            title={showConfirmPassword ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'}
                        >
                            {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
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

                {/* Tombol Simpan */}
                <button
                    type="submit"
                    disabled={isLoading || !currentPassword || !newPassword}
                    className="mt-2 w-full py-3 bg-primary hover:bg-primary-container text-on-primary rounded-full font-bold text-sm transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(56,74,216,0.25)]"
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Memverifikasi & Memperbarui...</span>
                        </>
                    ) : (
                        <span>Perbarui Kata Sandi</span>
                    )}
                </button>
            </form>
        </div>
    );
}
