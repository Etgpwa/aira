# Asisten Pribadi (Karen) - Architecture

Proyek ini menggunakan arsitektur **Monorepo** yang memisahkan aplikasi backend (bot WhatsApp) dan frontend (Dashboard PWA) dalam satu repositori.

## Struktur Direktori
- `apps/backend/` : Layanan backend Node.js untuk Bot WhatsApp.
- `apps/dashboard/` : Aplikasi web PWA dengan Next.js 14 (App Router).
- `packages/shared/` : Kode atau tipe yang digunakan bersama (jika ada).
- `supabase/` : Definisi skema database dan RLS.

## Backend (WhatsApp Bot & Cron)
- **Teknologi**: Node.js, TypeScript, Express, Baileys (WhatsApp Web API), node-cron.
- **Fungsi Utama**:
  - Menerima dan merespon pesan WhatsApp secara *real-time*.
  - Mengirim pesan ke modul AI (Gemini) untuk mendeteksi intensi (intent) pengguna. **Mendukung Multi-Intent**: 1 pesan majemuk dari user diparsing menjadi sebuah `array` intent untuk dieksekusi secara berurutan.
  - Melakukan *insert/update/delete* ke database Supabase menggunakan `Service Role Key` (melewati RLS karena aksi dilakukan oleh sistem atas perintah user terautentikasi via nomor HP).
  - Menjalankan *cron jobs* (Daily Briefing jam 06:00 dengan info seragam/medsos/terapi, Smart Reminders H-3 & H-1 jam tugas, Schedule Reminders H-30m, Debt Reminders jam 07:00, Custom Reminders 1 menit, dan Story Medsos Reminder jam 15:30 WIB Senin-Sabtu).
  - Manajemen Rutinitas Kerja (Work Routine Context): menghitung seragam harian dinamis dan siklus rolling 3 departemen Instagram story (`Homeschool`, `TSD`, `Okupasi`) dengan rumus pergeseran mingguan otomatis.
  - Multimodal OCR Visual Therapy Schedule: mengenali dokumen matriks jadwal terapi, membaca legenda warna terapis TSD (`[Anak]-[Inisial]`), membaca sesi OT, dan melayani query jadwal harian atau sesi yang sedang berlangsung saat ini ("sekarang siapa aja?").

## Frontend (Dashboard PWA)
- **Teknologi**: Next.js 14 (App Router), React 18, Tailwind CSS (diasumsikan/layout modern), Recharts.
- **Fungsi Utama**:
  - Menampilkan ringkasan keuangan, tugas, tabungan, dan jadwal dalam antarmuka web modern.
  - Berjalan sebagai PWA (Bisa di-install di perangkat *mobile*).
  - Interaksi *Real-time* tanpa *full reload*.
- **Routing**:
  - `/login`: Autentikasi.
  - `/`: Overview.
  - `/academic`: Modul Akademik, Kuis & Rekap Mingguan.
  - `/sandbox`: Karen AI Simulator & Pusat Pelatihan Intent Interaktif (Dry Run).
  - `/settings`: Pengaturan Profil, Keamanan & Preferensi.

## Dynamic AI Training & Prompt Injection
Untuk mempermudah pelatihan AI tanpa mengedit kode:
1. **Interactive Sandbox**: Sesi chat di `/sandbox` membaca konteks riil pengguna (saldo rekening, tugas, tabungan) sebagai patokan simulasi, namun bersifat *Dry-Run* tanpa memodifikasi database nyata.
2. **Dynamic Prompt Injection**: Hasil koreksi pengguna disimpan ke tabel `ai_training_rules`. Fungsi `getDynamicSystemPrompt()` di backend WhatsApp (`intent.detector.ts`) dan PWA Simulator secara otomatis menarik aturan aktif ini dan menyuntikkannya ke dalam System Prompt Gemini secara *real-time*.

Aplikasi menggunakan kombinasi *Server Components* dan *Real-time WebSockets* untuk mengelola *state*:
1. **Server-side Fetching**: Data diambil langsung dari Supabase di sisi server sebelum dikirim ke *client*.
2. **RealtimeSubscriber**: Komponen React di *client-side* yang *subscribe* ke *event* `postgres_changes` Supabase. Jika ada perubahan data di tabel yang relevan (misal diubah oleh bot WA), komponen ini akan memicu `router.refresh()` secara *debounced* untuk memperbarui UI tanpa mengganggu *state* interaktif lainnya.

## Alur Autentikasi (Auth Flow)
- Menggunakan Supabase Email & Password.
- Pengecekan sesi dilakukan di **Middleware Next.js** (`middleware.ts`) menggunakan `@supabase/ssr`.
- Rute terproteksi akan dialihkan ke `/login` jika tidak ada sesi valid.

## Environment Variables
- `SUPABASE_URL` & `SUPABASE_ANON_KEY`: Digunakan oleh Frontend & Backend.
- `SUPABASE_SERVICE_ROLE_KEY`: Eksklusif untuk Backend (Admin bypass RLS).
- `GEMINI_API_KEY`: Kunci API AI (mendukung rotasi).
- `WHATSAPP_PHONE_NUMBER`: *Whitelist* pengguna bot WA.
