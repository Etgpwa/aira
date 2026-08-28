# Asisten Pribadi (Aira) - Supabase Schema & Security

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

## Row Level Security (RLS)

Keamanan data terjamin ketat menggunakan mekanisme RLS PostgreSQL.
- **Status RLS**: Diaktifkan (`ENABLE ROW LEVEL SECURITY`) secara penuh untuk **semua tabel** aplikasi.
- **Policy Standard**: 
  Setiap tabel memiliki kebijakan: `USING (auth.uid() = user_id)`.
  Artinya: Saat *query* dilakukan dari aplikasi *client* (Frontend Next.js), pengguna yang masuk hanya bisa membaca, mengubah, atau menghapus data miliknya sendiri. Data pengguna lain secara otomatis disembunyikan oleh sistem database.

*Catatan: Backend (Bot WA) mem-bypass RLS ini dengan menggunakan `SUPABASE_SERVICE_ROLE_KEY` karena bot bertindak atas nama sistem, namun operasi dibatasi berdasarkan pencocokan nomor telepon pengirim dengan `phone_number` di `user_settings`.*
