import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { Settings, ShieldCheck } from 'lucide-react';
import ProfileSettingsForm from './components/ProfileSettingsForm';
import ChangePasswordForm from './components/ChangePasswordForm';
import RoutineSettingsForm from './components/RoutineSettingsForm';
import AccountsManager from './components/AccountsManager';
import CategoriesManager from './components/CategoriesManager';

export const revalidate = 0;

export default async function SettingsPage() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return notFound();

    const [settingsRes, routinesRes, accountsRes, categoriesRes] = await Promise.all([
        supabase.from('user_settings').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('work_routines').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('bank_accounts').select('*').eq('user_id', user.id).order('created_at', { ascending: true }),
        supabase.from('transaction_categories').select('*').eq('user_id', user.id).order('name', { ascending: true }),
    ]);

    const fullName = user.user_metadata?.full_name || '';
    const email = user.email || '';
    const phoneNumber = settingsRes.data?.phone_number || '';
    const initialUniforms = routinesRes.data?.uniform_schedule || {};
    const initialStoryTime = routinesRes.data?.story_reminder_time || '15:30:00';
    const accounts = accountsRes.data || [];
    const categories = categoriesRes.data || [];

    return (
        <div className="min-h-screen bg-surface">
            {/* Header */}
            <header className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-extrabold tracking-tight text-on-surface">Pengaturan</h1>
                    <p className="text-secondary text-sm mt-1">Konfigurasi profil, rutinitas kerja, dan preferensi akun</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-primary relative">
                    <Settings className="w-5 h-5" />
                </div>
            </header>

            {/* Layout 2-Kolom di Desktop / Single Kolom di Mobile */}
            <div className="flex flex-col lg:grid lg:grid-cols-2 gap-6 pb-6">
                {/* Kolom 1: Profil Pengguna, Keamanan Kata Sandi, & Rutinitas Kerja */}
                <div className="flex flex-col gap-6">
                    <ProfileSettingsForm
                        initialName={fullName}
                        email={email}
                        phoneNumber={phoneNumber}
                    />

                    <ChangePasswordForm userEmail={email} />

                    <RoutineSettingsForm
                        initialUniforms={initialUniforms}
                        initialStoryTime={initialStoryTime}
                    />
                </div>

                {/* Kolom 2: Rekening Bank & Kategori Transaksi */}
                <div className="flex flex-col gap-6">
                    <AccountsManager initialAccounts={accounts} />

                    <CategoriesManager initialCategories={categories} />
                </div>
            </div>

            {/* Footer Status Keamanan */}
            <div className="p-4 bg-surface-container-low rounded-2xl border border-surface-variant/40 flex items-center gap-3 text-xs text-secondary mt-2">
                <ShieldCheck className="w-5 h-5 text-mint-fg flex-shrink-0" />
                <span>
                    Data kamu diamankan dengan <strong>Row Level Security (RLS)</strong> Supabase dan terenkripsi.
                </span>
            </div>
        </div>
    );
}
