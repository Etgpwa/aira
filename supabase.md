# Asisten Pribadi (Karen) - Supabase Schema & Security

Proyek ini menggunakan Supabase sebagai database utama (PostgreSQL) dan *Authentication provider*.

## Tabel Database

Semua tabel memiliki kolom `user_id` yang berelasi langsung dengan tabel `auth.users` milik Supabase.

1. **`user_settings`**: Menyimpan preferensi pengguna (nomor telepon, mata uang *default*, zona waktu). Nomor telepon ini krusial untuk mencocokkan pengirim pesan WA dengan akun Supabase.
2. **`bank_accounts`**: Daftar dompet atau rekening bank pengguna (misal: BCA, GoPay, Tunai) beserta saldo saat ini.
3. **`transaction_categories`**: Kategori pengeluaran atau pemasukan (opsional bisa di-*seed* di awal).
4. **`transactions`**: Catatan pengeluaran, pemasukan, atau transfer antar rekening. Terhubung dengan `bank_accounts` dan `transaction_categories`.
5. **`budgets`**: Limit pengeluaran bulanan per kategori.
6. **`debts`**: Pencatatan hutang (user meminjam) dan piutang (orang lain meminjam ke user). Mendukung status pembayaran sebagian (*partial*) atau lunas (*paid*).
7. **`goals`**: Target tabungan virtual. Memiliki target nominal dan *progress* nominal terkumpul.
8. **`tasks`**: Daftar tugas atau *to-do list* dengan status (`TODO`, `IN_PROGRESS`, `DONE`) dan tingkat prioritas.
9. **`study_schedules`**: Jadwal kegiatan berulang mingguan berdasarkan hari (0-6) dan jam (mulai-selesai).
10. **`reminders`**: Pengingat bebas (ad-hoc) dan pengingat terhubung tugas. Menyimpan pesan, relasi `task_id` (opsional), target waktu `remind_at`, dan status (`PENDING`, `SENT`, `CANCELLED`). RLS diaktifkan.
11. **`work_routines`**: Konfigurasi seragam kerja harian (Senin-Sabtu), daftar 3 departemen medsos rolling (`Homeschool`, `TSD`, `Okupasi`), tanggal patokan rotasi (`rotation_anchor_date`), dan jam pengingat story (15:30 WIB). RLS diaktifkan.
12. **`therapy_schedules`**: Matriks jadwal terapi anak untuk departemen `TSD` (lengkap dengan inisial terapis berdasarkan legenda warna) dan `OT` (nama anak per sesi waktu), periode jadwal, serta hari aktif (Senin-Sabtu). RLS diaktifkan.
13. **`course_schedules`**: Jadwal kelas mingguan (matkul, hari, jam, ruangan, dosen). Diekstrak via Gemini Vision OCR (format Grid). RLS diaktifkan.
14. **`course_weekly_targets`**: Target progres materi mingguan per mata kuliah, dapat ditandai selesai (`is_completed`). Terikat pada minggu ke-N perkuliahan. RLS diaktifkan.
15. **`course_quiz_questions`**: Bank soal kuis otomatis hasil ekstraksi OCR (modul perkuliahan). Berisi teks soal, opsi A-D (jika MCQ), jawaban benar, dan tipe soal (MCQ/ESSAY). Menyimpan state `already_asked` untuk rotasi kuis harian. Terhubung ke `course_modules` via `module_id`. RLS diaktifkan.
16. **`course_modules`**: Kontainer materi akademik terstruktur per Mata Kuliah → Modul → KB (Kegiatan Belajar). Menyimpan `best_score` dan status `is_completed` yang di-update otomatis ketika kuis diselesaikan di PWA. RLS diaktifkan.
17. **`ai_training_rules`**: Aturan kustom dan contoh *few-shot* intent AI yang diajarkan pengguna secara interaktif dari PWA Sandbox (`/sandbox`). Berisi `sample_phrase`, `expected_intents` (JSONB), `explanation_rule`, dan status `is_active`. Otomatis disuntikkan ke prompt Bot WhatsApp dan Simulator. RLS diaktifkan.

## Row Level Security (RLS)

Keamanan data terjamin ketat menggunakan mekanisme RLS PostgreSQL.
- **Status RLS**: Diaktifkan (`ENABLE ROW LEVEL SECURITY`) secara penuh untuk **semua tabel** aplikasi.
- **Policy Standard**: 
  Setiap tabel memiliki kebijakan: `USING (auth.uid() = user_id)`.
  Artinya: Saat *query* dilakukan dari aplikasi *client* (Frontend Next.js), pengguna yang masuk hanya bisa membaca, mengubah, atau menghapus data miliknya sendiri. Data pengguna lain secara otomatis disembunyikan oleh sistem database.

*Catatan: Backend (Bot WA) mem-bypass RLS ini dengan menggunakan `SUPABASE_SERVICE_ROLE_KEY` karena bot bertindak atas nama sistem, namun operasi dibatasi berdasarkan pencocokan nomor telepon pengirim dengan `phone_number` di `user_settings`.*
