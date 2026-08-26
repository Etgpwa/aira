import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
// Gunakan Service Role Key untuk backend agar bisa bypass RLS saat menangani request dari WhatsApp
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn("⚠️ WARNING: SUPABASE_SERVICE_ROLE_KEY belum di-set di .env. Backend mungkin akan gagal write ke database jika RLS aktif!");
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});
