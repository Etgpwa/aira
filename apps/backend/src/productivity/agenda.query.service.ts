import { supabase } from '../supabase/supabase.client';
import { askGemini } from '../ai/gemini.client';

export class AgendaQueryService {
    async answerAgendaQuery(userId: string, question: string): Promise<string> {
        // 1. Ambil semua tasks yang belum selesai, urutkan dari due_date terdekat (urgent)
        const { data: tasks } = await supabase
            .from('tasks')
            .select('*')
            .eq('user_id', userId)
            .in('status', ['TODO', 'IN_PROGRESS'])
            .order('due_date', { ascending: true, nullsFirst: false });

        // 2. Ambil semua jadwal
        const { data: schedules } = await supabase
            .from('study_schedules')
            .select('*')
            .eq('user_id', userId)
            .order('day_of_week', { ascending: true })
            .order('start_time', { ascending: true });

        const dataContext = {
            currentTime: new Date().toISOString(),
            pendingTasks: tasks || [],
            regularSchedules: schedules || []
        };

        const jsonContext = JSON.stringify(dataContext, null, 2);

        const systemPrompt = `
Kamu adalah asisten pribadi yang menjawab pertanyaan user seputar tugas dan jadwal.

DATA JADWAL DAN TUGAS USER (waktu saat ini: ${new Date().toISOString()}):
\`\`\`json
${jsonContext}
\`\`\`

ATURAN STRICT MENJAWAB (HARUS PATUH):
1. **DILARANG MENGGUNAKAN EMOJI / EMOTICON SAMA SEKALI (0 EMOJI).**
2. **FORMAT LIST**: Setiap item HARUS berbaris sendiri diawali simbol bullet (• ). DILARANG memisahkan item dengan koma dalam 1 baris.
3. **PISAHKAN TIAP KATEGORI DENGAN TEPAT 1 BARIS KOSONG (ENTER DUA KALI / \\n\\n)** agar ada jeda antar blok kategori (misal: KULIAH HARI INI:, TUGAS URGENT:, DEADLINE BESOK:).
4. **WAKTU / JAM**: Selalu gunakan waktu dalam format WIB (Waktu Indonesia Barat), jangan pernah menulis "UTC".
5. **URUTAN URGENT**: Urutkan daftar tugas dari yang paling urgent (due date terdekat / prioritas HIGH di atas).
6. **DILARANG BASA-BASI**: Tanpa salam pembuka ("Halo", "Tentu") atau penutup ("Semoga lancar").
7. **JANGAN POTONG DETAIL**: Sebutkan rincian lengkap tugas atau jadwal (judul/matkul, jam, tanggal, prioritas) sesuai data.
8. Jika ditanya tugas/jadwal hari ini, filter data jadwal berdasarkan hari (0=Minggu, 1=Senin, dst) dan cocokkan dengan waktu saat ini.
9. Jangan sebut nama "Karen".
`;

        const reply = await askGemini(question, systemPrompt);
        return reply.trim();
    }
}

export const agendaQueryService = new AgendaQueryService();
