import { supabase } from '../supabase/supabase.client';

export class UserService {
    /**
     * Cari atau buat user berdasarkan nomor WhatsApp.
     * Ini penting karena di tahap ini user belum mendaftar lewat PWA.
     * Kita menggunakan Supabase Admin API untuk membuat 'headless user'.
     */
    async getOrCreateUserByPhone(phoneNumber: string): Promise<string> {
        // 1. Cek apakah user_settings sudah ada (support multi-number / LID match)
        const { data: existingUsers } = await supabase
            .from('user_settings')
            .select('user_id')
            .ilike('phone_number', `%${phoneNumber}%`)
            .limit(1);

        if (existingUsers && existingUsers.length > 0) {
            return existingUsers[0].user_id;
        }

        // 2. Jika belum ada, kita buat user baru di auth.users (headless)
        // Gunakan nomor telepon dummy sebagai email karena auth.users wajib butuh email di beberapa konfigurasi default
        const dummyEmail = `${phoneNumber}@asistenpribadi.local`;
        
        console.log(`👤 Membuat user baru untuk WhatsApp: ${phoneNumber}`);
        
        const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
            email: dummyEmail,
            email_confirm: true,
            password: 'WhatsAppUser123!', // Password acak yang aman
            user_metadata: { phone: phoneNumber }
        });

        if (authErr) {
            console.error("Gagal membuat auth user:", authErr);
            throw new Error('Gagal membuat user baru di database');
        }

        const userId = authData.user.id;

        // 3. Masukkan ke user_settings
        const { error: settingsErr } = await supabase
            .from('user_settings')
            .insert({
                user_id: userId,
                phone_number: phoneNumber,
                default_currency: 'IDR'
            });

        if (settingsErr) {
            console.error("Gagal membuat user_settings:", settingsErr);
            throw new Error('Gagal inisialisasi pengaturan user');
        }
        
        // 4. Buat Rekening Default (Cash)
        await supabase.from('bank_accounts').insert({
            user_id: userId,
            name: 'Cash',
            currency: 'IDR',
            balance: 0
        });

        return userId;
    }
}

export const userService = new UserService();
