# Asisten Pribadi (Aira) - AI Agent Integration

Asisten Aira ditenagai oleh model AI generatif (Google Gemini) untuk memproses pesan WhatsApp dari pengguna (*Natural Language Processing*), mengekstrak niat (*intent*), dan mengubahnya menjadi *actionable data* terstruktur (JSON).

## 1. Mekanisme Deteksi Intent
Pemrosesan pesan masuk terjadi di backend menggunakan komponen `intent.detector.ts` dan `gemini.client.ts`.
- **System Prompt**: Menginstruksikan AI untuk berperan sebagai "Aira" (asisten pribadi). AI diberikan daftar intent valid, format waktu real-time, dan aturan ketat (tidak boleh menggunakan markdown backticks, tidak boleh pakai emoji, respon sangat singkat).
- **Format Output**: AI diinstruksikan untuk selalu mengembalikan *response* dalam bentuk JSON murni yang sesuai dengan *interface* `IntentResult`.

Daftar Intent yang Didukung:
- `ADD_EXPENSE`, `ADD_INCOME`
- `SET_BALANCE`, `SET_BUDGET`
- `ADD_DEBT`, `ADD_RECEIVABLE`, `PAY_DEBT`
- `CREATE_GOAL`, `TOPUP_GOAL`, `DELETE_GOAL`
- `QUERY_FINANCE`
- `ADD_TASK`, `COMPLETE_TASK`, `UPDATE_TASK_PROGRESS`, `DELETE_TASK`
- `ADD_SCHEDULE`, `DELETE_SCHEDULE`, `QUERY_AGENDA`
- `CHITCHAT`, `UNKNOWN`

## 2. OCR (Optical Character Recognition)
Aira dilengkapi dengan kemampuan *Vision* untuk membaca gambar struk atau nota belanjaan. Jika pengguna mengirim gambar struk lewat WA:
- Gambar diteruskan ke model Gemini Vision (`gemini-1.5-flash`).
- Model menganalisis gambar untuk mengekstrak Total Belanja, Kategori, dan Daftar Item.
- Hasil ekstraksi otomatis dicatat sebagai transaksi `ADD_EXPENSE` tanpa pengguna perlu mengetik rincian secara manual.

## 3. Fitur Keandalan (Reliability)
### Rotasi API Key (Anti-Limit)
Untuk mencegah limit permintaan (Error 429) atau server overload (Error 503) dari API gratis Gemini, sistem `gemini.client.ts` menggunakan strategi **Round-Robin API Key Rotation**:
- Sistem membaca sekumpulan kunci API yang dipisahkan oleh koma di *environment variables*.
- Setiap *request* akan menggunakan indeks *key* yang berbeda secara bergantian.
- Jika satu *key* gagal/kehabisan limit, sistem akan melempar *error*, dan secara logis pemanggilan berikutnya akan menggunakan *key* selanjutnya.

### Memory Manager (Riwayat Percakapan Pendek)
- Agar bot memiliki memori konteks singkat, `memory.manager.ts` menyimpan riwayat percakapan (*history*) maksimum 4 percakapan terakhir berdasarkan ID Sesi (nomor HP).
- Memori ini berguna agar Aira mengerti jika pesan terbaru merujuk/merevisi pesan sesaat sebelumnya.

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