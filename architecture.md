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
  - `/academic`: Modul Akademik, Bank Soal, & Progres Silabus Kuliah UT.
  - `/academic/[moduleId]`: Detail KB, Scan Soal & Kunci (Multiple Pick File OCR), dan Bank Soal.
  - `/academic/[moduleId]/quiz`: Simulator Ujian CBT Mandiri (Mode Normal & Mode Challenge AI Paraphrase).
  - `/academic/event`: Simulasi UTS/UAS dari KB pilihan, dengan paket hingga 30 pilihan ganda acak atau semua soal.
  - `/academic/kisi-kisi`: Tampilan baca soal, kunci jawaban, visual, dan catatan penjelasan per soal.
  - `/academic/schedule`: Roadmap Perencanaan Studi & Sesi Perkuliahan Mandiri UT.
  - `/sandbox`: Karen AI Simulator & Pusat Pelatihan Intent Interaktif (Dry Run).
  - `/settings`: Pengaturan Profil, Keamanan & Preferensi.

## Pengurutan dan Request OCR Academic

- Pratinjau diurutkan numerik berdasarkan source_number, tanpa mengubah indeks draft untuk edit, eksklusi, konteks, dan solusi. Nomor tidak diketahui di akhir; nomor ganda tetap stabil.
- Nomor asli disimpan melalui migrasi supabase/add_source_number_to_quiz_questions.sql. Bank soal dan kuis mengurutkan nomor asli; kunci dipasangkan dengan nomor asli, bukan urutan scan. Data lama tanpa nomor tetap memakai urutan created_at dan tidak ditebak ulang.
- Sidik SHA-256 isi foto mencegah request ulang ketika sudah ada hasil foto di pratinjau. Foto tanpa hasil boleh dicoba lagi. Batal atau selesai simpan membersihkan daftar sidik foto.

## Alur Scan Soal Academic

1. Browser memotong screenshot soal yang panjang menjadi bagian vertikal yang tumpang tindih sebelum membuat JPEG maksimal 2.000 px. Tiap bagian dikirim berurutan ke `POST /api/academic/ocr` dan hasil yang berhasil masuk ke pratinjau meski bagian lain gagal. Panel API OCR memilih Gemini atau TokenMurah untuk Scan Soal dan Scan Kunci.
   Pilihan TokenMurah mengirim foto sebagai data URL ke Chat Completions dengan key sesi tab. Endpoint memakai model yang dipilih dan parser OCR yang sama dengan Gemini.
2. Model OCR mengembalikan teks, nomor, rujukan, bacaan, solusi, dan koordinat visual. Browser menyatukan soal yang cocok dari potongan tumpang tindih dan memetakan koordinat ke foto asli sebelum memotong visual sebagai WebP. Hasil semua foto digabung untuk menelusuri rujukan berdasarkan nomor atau nama kasus. Rujukan hilang atau ambigu ditandai di pratinjau.
3. Saat disimpan, konteks ditempel ke teks soal dan potongan disimpan di kolom `course_quiz_questions.ocr_images`. Bank soal dan CBT menampilkan visual sesuai letaknya. Gambar solusi tersedia di pembahasan. Soal bergambar tetap memakai versi asli di Challenge dan bank soal kuis teks WhatsApp menyaringnya.

## Alur Challenge Mode (Kuis Kuliah)
1. `QuizRunner.tsx` mengambil sampel soal MCQ asli; bila mode awal `challenge` (via `?mode=challenge`) atau user menekan tab Challenge, server action `batchParaphraseQuestions` dipanggil (chunk 10 soal ke Gemini).
2. Tiap hasil divalidasi (kalimat harus berbeda dari asli, opsi lengkap), di-retry 1x bila gagal, lalu posisi opsi diacak dan `correct_answer` dipetakan ulang. Soal gagal tetap tampil asli dengan `is_paraphrased: false`.
3. UI menampilkan peringatan + tombol "Coba lagi" bila ada soal gagal. QuizRunner menyiapkan Challenge untuk kuis KB dan Event. Browser mengirim kelompok pilihan ganda tanpa gambar ke server secara berurutan. Esai dan soal bergambar memakai teks asli.

## Simulasi UAS dan Kisi-kisi

- Simulasi memuat daftar ID dari seluruh halaman Supabase untuk KB pilihan. Browser mengambil isi soal dalam kelompok kecil agar gambar OCR tidak menumpuk dalam satu respons. Paket acak mengambil hingga 30 pilihan ganda. Paket semua soal menyertakan pilihan ganda dan esai. QuizRunner memakai seluruh isi paket untuk mulai dan ulang. Esai dibandingkan dengan kunci di review, sementara skor dihitung dari pilihan ganda.
- Kisi-kisi membaca bank soal secara bertahap per halaman dan dapat difilter per mata kuliah. Kunci jawaban ditampilkan bersama visual yang tersimpan. Catatan menggunakan kolom `course_quiz_questions.user_note` yang sama dengan review simulasi, disimpan otomatis setelah jeda mengetik atau saat meninggalkan kolom catatan.

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
