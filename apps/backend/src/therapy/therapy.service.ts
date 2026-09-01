import { supabase } from '../supabase/supabase.client';
import { askGeminiVision } from '../ai/gemini.client';

export interface TherapyItem {
    department: 'TSD' | 'OT';
    day_of_week: number; // 1 = Senin, 2 = Selasa, ..., 6 = Sabtu
    session_number: number | null;
    time_range: string;
    child_name: string;
    therapist_initial: string | null;
}

export class TherapyService {
    /**
     * Membaca dan mengekstrak matriks jadwal terapi TSD & OT dari gambar via Gemini Vision
     */
    async parseScheduleImage(imageBuffer: Buffer, mimeType: string): Promise<{ period_label: string; items: TherapyItem[] } | null> {
        const prompt = `
Analisis gambar jadwal terapi anak ini secara sangat teliti.
Gambar ini berisi 2 tabel:
1. "JADWAL TERAPI TSD" (di bagian atas)
2. "JADWAL TERAPI OT" / Okupasi Terapi (di bagian bawah)

LEGENDA WARNA KHUSUS TABEL TSD (Warna background kotak nama anak menentukan inisial terapis):
- Cyan / Biru Muda = Ms Ningga -> inisial "N"
- Hijau / Green = Ms Fara -> inisial "F"
- Ungu / Magenta / Purple = Ms Nabila -> inisial "Nb"
- Oranye / Orange = Ms Jesisca -> inisial "J"
- Kuning / Yellow = Ms Riska -> inisial "R"
- Jika kotak anak putih/abu-abu/tanpa warna khusus (misal "Obs Darrel"), inisialnya null.

ATURAN TABEL TSD:
- Kolom: Waktu | Senin (1) | Selasa (2) | Rabu (3) | Kamis (4) | Jumat (5) | Sabtu (6)
- Sesi 1: 08.00-09.30
- Sesi 2: 09.30-11.00
- Sesi 3: 12.00-13.30
- Sesi 4: 13.30-15.00
- Sesi 5: 15.15-16.45
Setiap anak di dalam sel harus diekstrak dengan nama anak dan inisial terapisnya sesuai warna kotaknya.

ATURAN TABEL OT (OKUPASI):
- Kolom: Sesi | Waktu | Senin (1) | Selasa (2) | Rabu (3) | Kamis (4) | Jum'at (5) | Sabtu (6)
- Untuk tabel OT, TIDAK PERLU inisial terapis (therapist_initial = null), hanya nama anak saja!
- Jika sesi tidak memiliki nomor angka (misal baris 11.00-12.00), gunakan session_number: 0.
- Jika suatu sel kosong, jangan buat item.

Kembalikan HANYA JSON murni tanpa markdown backticks dalam format:
{
  "period_label": "Agustus 2026",
  "items": [
    {
      "department": "TSD",
      "day_of_week": 1,
      "session_number": 1,
      "time_range": "08.00-09.30",
      "child_name": "Redian",
      "therapist_initial": "J"
    },
    {
      "department": "TSD",
      "day_of_week": 1,
      "session_number": 1,
      "time_range": "08.00-09.30",
      "child_name": "Olyn",
      "therapist_initial": "R"
    },
    {
      "department": "OT",
      "day_of_week": 1,
      "session_number": 1,
      "time_range": "08.00-09.00",
      "child_name": "A Hasan",
      "therapist_initial": null
    }
  ]
}
`;

        try {
            const rawResponse = await askGeminiVision(imageBuffer, mimeType, prompt);
            let cleaned = rawResponse.trim();
            if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
            if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
            if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);

            const parsed = JSON.parse(cleaned.trim());
            if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
                return parsed;
            }
            return null;
        } catch (err) {
            console.error('❌ Gagal parse jadwal terapi dari gambar:', err);
            return null;
        }
    }

    /**
     * Menyimpan jadwal hasil OCR ke Supabase (auto-replace periode yang sama)
     */
    async saveSchedule(userId: string, data: { period_label: string; items: TherapyItem[] }): Promise<number> {
        const period = data.period_label || 'Aktif';

        // 1. Hapus jadwal lama untuk user ini pada periode tersebut (atau hapus semua agar fresh)
        await supabase
            .from('therapy_schedules')
            .delete()
            .eq('user_id', userId);

        // 2. Batch insert
        const rows = data.items.map(item => ({
            user_id: userId,
            period_label: period,
            department: item.department,
            day_of_week: item.day_of_week,
            session_number: item.session_number != null ? Number(item.session_number) : 0,
            time_range: item.time_range,
            child_name: item.child_name,
            therapist_initial: item.therapist_initial || null
        }));

        const { error } = await supabase
            .from('therapy_schedules')
            .insert(rows);

        if (error) {
            console.error('❌ Gagal insert therapy_schedules:', error);
            throw error;
        }

        console.log(`✅ Berhasil menyimpan ${rows.length} slot jadwal terapi periode ${period}`);
        return rows.length;
    }

    /**
     * Mengambil jadwal terapi berdasarkan hari dan/atau departemen
     */
    async getSchedule(userId: string, dayOfWeek: number, department?: 'TSD' | 'OT'): Promise<TherapyItem[]> {
        let query = supabase
            .from('therapy_schedules')
            .select('*')
            .eq('user_id', userId)
            .eq('day_of_week', dayOfWeek);

        if (department) {
            query = query.eq('department', department);
        }

        const { data, error } = await query;
        if (error || !data) return [];

        // Urutkan berdasarkan waktu mulai (menit dalam hari)
        const parseMinutes = (range: string) => {
            const m = range.replace(':', '.').match(/^(\d{1,2})[.](\d{2})/);
            if (!m) return 0;
            return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
        };

        return (data as TherapyItem[]).sort((a, b) => parseMinutes(a.time_range) - parseMinutes(b.time_range));
    }

    /**
     * Menjawab query jadwal terapi:
     * - jadwal hari ini / besok / hari tertentu
     * - jadwal sekarang (siapa yang sedang sesi terapi saat ini)
     */
    async answerScheduleQuery(userId: string, queryText: string): Promise<string> {
        const lower = queryText.toLowerCase();

        // 1. Cek apakah user tanya "sekarang siapa aja" / "saat ini"
        const isCurrentSessionQuery = /sekarang|saat ini|lagi sesi/i.test(lower);

        // Dapatkan waktu saat ini di WIB
        const nowWib = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
        let targetDay = nowWib.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat

        // Cek jika tanya hari tertentu
        if (/besok/i.test(lower)) {
            targetDay = (targetDay + 1) % 7;
        } else if (/senin/i.test(lower)) targetDay = 1;
        else if (/selasa/i.test(lower)) targetDay = 2;
        else if (/rabu/i.test(lower)) targetDay = 3;
        else if (/kamis/i.test(lower)) targetDay = 4;
        else if (/jumat|jum'at/i.test(lower)) targetDay = 5;
        else if (/sabtu/i.test(lower)) targetDay = 6;
        else if (/minggu/i.test(lower)) targetDay = 0;

        if (targetDay === 0) {
            return "Hari Minggu tidak ada jadwal terapi (libur).";
        }

        // Cek departemen spesifik
        let deptFilter: 'TSD' | 'OT' | undefined = undefined;
        if (/tsd/i.test(lower) && !/okupasi|ot/i.test(lower)) deptFilter = 'TSD';
        if ((/okupasi|ot/i.test(lower)) && !/tsd/i.test(lower)) deptFilter = 'OT';

        const dayNames = ['', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
        const dayLabel = dayNames[targetDay];

        const allItems = await this.getSchedule(userId, targetDay, deptFilter);
        if (allItems.length === 0) {
            return `Belum ada jadwal terapi yang tersimpan untuk hari ${dayLabel}. Kamu bisa kirimkan foto jadwal terapi untuk disimpan otomatis.`;
        }

        // JIKA TANYA SESI SEKARANG
        if (isCurrentSessionQuery && targetDay === nowWib.getDay()) {
            const currentHourMin = nowWib.getHours() * 60 + nowWib.getMinutes(); // menit dalam hari
            const timeStr = `${String(nowWib.getHours()).padStart(2, '0')}:${String(nowWib.getMinutes()).padStart(2, '0')}`;

            // Helper cek apakah waktu saat ini masuk rentang
            const isInside = (rangeStr: string) => {
                // e.g. "08.00-09.30" atau "08:00-09:30"
                const parts = rangeStr.replace(/:/g, '.').split('-');
                if (parts.length !== 2) return false;
                const [startH, startM] = parts[0].trim().split('.').map(Number);
                const [endH, endM] = parts[1].trim().split('.').map(Number);
                const startTotal = startH * 60 + (startM || 0);
                const endTotal = endH * 60 + (endM || 0);
                return currentHourMin >= startTotal && currentHourMin <= endTotal;
            };

            const ongoingTsd = allItems.filter(i => i.department === 'TSD' && isInside(i.time_range));
            const ongoingOt = allItems.filter(i => i.department === 'OT' && isInside(i.time_range));

            if (ongoingTsd.length === 0 && ongoingOt.length === 0) {
                return `Saat ini (jam ${timeStr} WIB) sedang tidak ada sesi terapi yang berlangsung untuk hari ${dayLabel}.`;
            }

            let res = `JADWAL TERAPI SAAT INI (${timeStr} WIB)\n`;

            if (ongoingTsd.length > 0) {
                const range = ongoingTsd[0].time_range;
                const sessionNum = ongoingTsd[0].session_number;
                const sessLabel = sessionNum && sessionNum > 0 ? `Sesi ${sessionNum}` : `Sesi Tambahan`;
                res += `\nTSD (${sessLabel}: ${range}):\n`;
                for (const i of ongoingTsd) {
                    const formatted = i.therapist_initial ? `${i.child_name}-${i.therapist_initial}` : i.child_name;
                    res += `    - ${formatted}\n`;
                }
            }

            if (ongoingOt.length > 0) {
                const range = ongoingOt[0].time_range;
                const sessionNum = ongoingOt[0].session_number;
                const sessLabel = sessionNum && sessionNum > 0 ? `Sesi ${sessionNum}` : `Sesi Tambahan`;
                res += `\nOKUPASI (${sessLabel}: ${range}):\n`;
                for (const i of ongoingOt) {
                    res += `    - ${i.child_name}\n`;
                }
            }

            return res.trim();
        }

        // TAMPILAN JADWAL HARIAN LENGKAP
        let res = `JADWAL TERAPI ${dayLabel}\n`;

        // Bagian TSD
        const tsdItems = allItems.filter(i => i.department === 'TSD');
        if (tsdItems.length > 0 && (!deptFilter || deptFilter === 'TSD')) {
            res += `\nTSD:\n`;
            const sessions = new Map<string, { range: string; sessionNum: number; kids: string[] }>();
            for (const item of tsdItems) {
                const key = item.time_range;
                if (!sessions.has(key)) {
                    sessions.set(key, { range: item.time_range, sessionNum: item.session_number ?? 0, kids: [] });
                }
                const formatted = item.therapist_initial ? `${item.child_name}-${item.therapist_initial}` : item.child_name;
                sessions.get(key)!.kids.push(formatted);
            }

            for (const [, sessData] of sessions) {
                const sessLabel = sessData.sessionNum > 0 ? `Sesi ${sessData.sessionNum}` : `Sesi Tambahan`;
                res += `• ${sessLabel} (${sessData.range}):\n`;
                for (const kid of sessData.kids) {
                    res += `    - ${kid}\n`;
                }
            }
        }

        // Bagian Okupasi (OT)
        const otItems = allItems.filter(i => i.department === 'OT');
        if (otItems.length > 0 && (!deptFilter || deptFilter === 'OT')) {
            res += `\nOKUPASI (OT):\n`;
            const sessions = new Map<string, { range: string; sessionNum: number; kids: string[] }>();
            for (const item of otItems) {
                const key = item.time_range;
                if (!sessions.has(key)) {
                    sessions.set(key, { range: item.time_range, sessionNum: item.session_number ?? 0, kids: [] });
                }
                sessions.get(key)!.kids.push(item.child_name);
            }

            for (const [, sessData] of sessions) {
                const sessLabel = sessData.sessionNum > 0 ? `Sesi ${sessData.sessionNum}` : `Sesi Tambahan`;
                if (sessData.kids.length === 1) {
                    res += `• ${sessLabel} (${sessData.range}): ${sessData.kids[0]}\n`;
                } else {
                    res += `• ${sessLabel} (${sessData.range}):\n`;
                    for (const kid of sessData.kids) {
                        res += `    - ${kid}\n`;
                    }
                }
            }
        }

        return res.trim();
    }
}

export const therapyService = new TherapyService();
