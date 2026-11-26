# Asisten Pribadi (Karen) - AI Agent Integration

Asisten Karen ditenagai oleh model AI generatif (Google Gemini) untuk memproses pesan WhatsApp dari pengguna (*Natural Language Processing*), mengekstrak niat (*intent*), dan mengubahnya menjadi *actionable data* terstruktur (JSON).

## 1. Mekanisme Deteksi Intent
Pemrosesan pesan masuk terjadi di backend menggunakan komponen `intent.detector.ts` dan `gemini.client.ts`.
- **System Prompt**: Menginstruksikan AI untuk berperan sebagai "Karen" (asisten pribadi). AI diberikan daftar intent valid, format waktu real-time, dan aturan ketat (tidak boleh menggunakan markdown backticks, tidak boleh pakai emoji, respon sangat singkat).
- **Format Output**: AI diinstruksikan untuk mengembalikan *response* dalam bentuk JSON murni dengan `interface IntentResult`. Sistem mendukung **Multi-Intent**, artinya jika user mengirim pesan panjang berisi banyak instruksi sekaligus, AI akan memecahnya menjadi sebuah array `intents`.

Daftar Intent yang Didukung:
- `ADD_EXPENSE`, `ADD_INCOME`, `UPDATE_LAST_TRANSACTION`, `CANCEL_LAST_TRANSACTION`, `DELETE_TRANSACTION`
- `SET_BALANCE`, `SET_BUDGET`
- `ADD_DEBT`, `ADD_RECEIVABLE`, `PAY_DEBT`
- `CREATE_GOAL`, `TOPUP_GOAL`, `DELETE_GOAL`
- `QUERY_FINANCE`
- `ADD_TASK`, `COMPLETE_TASK`, `UPDATE_TASK_PROGRESS`, `DELETE_TASK`
- `ADD_SCHEDULE`, `DELETE_SCHEDULE`, `QUERY_AGENDA`
- `ADD_REMINDER`, `RESCHEDULE_REMINDER`, `DELETE_REMINDER`
- `QUERY_ROUTINE`, `UPDATE_ROUTINE`
- `QUERY_THERAPY_SCHEDULE`
- `CHITCHAT`, `UNKNOWN`

## 2. OCR (Optical Character Recognition)
Karen dilengkapi dengan kemampuan *Vision* Multimodal untuk membaca dokumen dan gambar:
- **Struk Belanja**: Model Gemini Vision menganalisis gambar untuk mengekstrak Total Belanja, Kategori, dan Merchant, lalu otomatis mencatatnya sebagai transaksi `ADD_EXPENSE`.
- **Jadwal Terapi (TSD & OT)**: Menganalisis matriks tabel jadwal terapi anak bulanan. Menghubungkan warna sel dengan legenda terapis pada tabel TSD (`[Anak]-[Inisial]`) serta membaca sesi nama anak pada tabel OT. Jadwal otomatis di-upsert ke database dan siap ditanyakan kapan saja ("jadwal hari ini", "sekarang siapa aja?").

## 3. Fitur Keandalan (Reliability)
### Rotasi API Key (Anti-Limit)
Untuk mencegah limit permintaan (Error 429) atau server overload (Error 503) dari API gratis Gemini, sistem `gemini.client.ts` menggunakan strategi **Round-Robin API Key Rotation**:
- Sistem membaca sekumpulan kunci API yang dipisahkan oleh koma di *environment variables*.
- Setiap *request* akan menggunakan indeks *key* yang berbeda secara bergantian.
- Jika satu *key* gagal/kehabisan limit, sistem akan melempar *error*, dan secara logis pemanggilan berikutnya akan menggunakan *key* selanjutnya.

### Memory Manager (Riwayat Percakapan Pendek)
- Agar bot memiliki memori konteks singkat, `memory.manager.ts` menyimpan riwayat percakapan (*history*) maksimum 4 percakapan terakhir berdasarkan ID Sesi (nomor HP).
- Memori ini berguna agar Karen mengerti jika pesan terbaru merujuk/merevisi pesan sesaat sebelumnya.

### OCR Academic di Dashboard
- Scan Soal dan Scan Kunci memakai `gemini-3.8-flash` melalui `/api/academic/ocr`, dengan respons JSON dan tingkat *thinking* rendah. OCR mencoba key berbeda pada model utama selama masih ada waktu. Model `gemini-3.6-flash` dapat dipakai saat kuota, layanan, atau respons model utama bermasalah, dan diprioritaskan setelah dua balasan HTTP 503. Key yang ditolak tidak dicoba ulang pada model cadangan. Respons pertama yang kosong dapat dikonfirmasi lewat percobaan berikutnya.
- Daftar key dipisahkan dengan koma. Endpoint membaca `GEMINI_API_KEYS`, lalu memakai `GEMINI_API_KEY` sebagai cadangan konfigurasi. Untuk dashboard lokal, gunakan `apps/dashboard/.env.local`. Dashboard yang berjalan di Vercel memakai Environment Variables proyek Vercel. Nilai `.env` di root dibaca backend WhatsApp saat dijalankan lokal.
- Panel **API OCR** di detail KB menerima key pribadi Gemini standar atau berawalan `AQ.`, serta key TokenMurah `sk-tm-` atau `sk-tp-`. Key tersimpan di `sessionStorage` sesuai ID akun dan dikirim pada request OCR terautentikasi, tanpa penyimpanan ke database atau log. Pengguna memilih penyedia secara eksplisit dan dapat kembali memakai key dashboard.
- TokenMurah memakai ID model yang menerima gambar, dengan default `gpt-5.4-mini`. Server memakai Chat Completions di `https://tokenmurah.net/v1/chat/completions` dan melakukan satu panggilan per bagian scan. TokenMurah memakai saldo atau kuota akun yang menerbitkan key dan hanya dipanggil saat pengguna mengaktifkannya.
- Urutan mulai key dashboard bergantian tiap permintaan. Key pribadi dicoba dari urutan masukan. Tenggat total OCR adalah 30 detik per request, dengan maksimal 18 detik untuk model utama dan sisa waktunya untuk model cadangan. Tenggat tiap percobaan diatur melalui `AbortSignal` lokal agar sisa waktu di bawah minimum Gemini tidak terkirim sebagai deadline di header. Log mencatat nomor urut key dan status kegagalan. Pesan gagal menunjukkan jumlah key yang dicoba.

## Aturan Wajib: Auto-update Dokumentasi

Setiap kali kamu selesai fix bug, menambah fitur, atau mengubah 
konfigurasi, kamu WAJIB tanpa diminta:

1. Update progress.md — pindahkan item dari "Known Issues" ke "Fixed", 
   atau tambahkan status baru
2. Kalau perubahan menyentuh skema Supabase → update supabase.md 
   dan ingatkan user untuk re-dump schema
3. Kalau perubahan mengubah arsitektur/flow (misal: cara handle 
   webhook, state management, dll) → update architecture.md
4. Kalau perubahan menyangkut config/env var/API key rotation → 
   update agent.md
5. Tulis ringkasan perubahan di akhir jawaban dengan format:
   "📝 Docs updated: [nama file] - [ringkasan singkat perubahan]"

Jangan tunggu diminta. Ini bagian dari definisi "selesai" untuk 
setiap task, bukan langkah opsional.
