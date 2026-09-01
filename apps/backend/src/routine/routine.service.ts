import { supabase } from '../supabase/supabase.client';
import { askGemini } from '../ai/gemini.client';

export interface WorkRoutine {
    id: string;
    user_id: string;
    uniform_schedule: Record<string, string>; // "1": "Batik", ..., "6": "Bebas Rapi"
    social_media_departments: string[];       // ["Homeschool", "TSD", "Okupasi"]
    rotation_anchor_date: string;            // "2026-08-31"
    story_reminder_time: string;             // "15:30:00"
}

export class RoutineService {
    private defaultUniforms: Record<string, string> = {
        '1': 'Batik',
        '2': 'Kemeja',
        '3': 'Bebas Rapi',
        '4': 'Batik',
        '5': 'Kaos Polo',
        '6': 'Bebas Rapi'
    };

    private defaultDepartments = ['Homeschool', 'TSD', 'Okupasi'];
    private defaultAnchorDate = '2026-08-31';

    /**
     * Ambil atau buat pengaturan rutin kerja pengguna
     */
    async getOrCreateWorkRoutine(userId: string): Promise<WorkRoutine> {
        const { data, error } = await supabase
            .from('work_routines')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

        if (data) {
            return data as WorkRoutine;
        }

        const newRoutine = {
            user_id: userId,
            uniform_schedule: this.defaultUniforms,
            social_media_departments: this.defaultDepartments,
            rotation_anchor_date: this.defaultAnchorDate,
            story_reminder_time: '15:30:00'
        };

        const { data: created, error: createErr } = await supabase
            .from('work_routines')
            .insert(newRoutine)
            .select()
            .single();

        if (createErr) {
            console.error('❌ Gagal inisialisasi work_routines:', createErr);
            return {
                id: 'temp',
                ...newRoutine
            };
        }

        return created as WorkRoutine;
    }

    /**
     * Menghitung konteks harian: seragam dan departemen giliran story IG
     */
    async calculateDailyContext(userId: string, targetDate = new Date()) {
        const routine = await this.getOrCreateWorkRoutine(userId);

        // Zona waktu Asia/Jakarta (WIB)
        const dateStr = targetDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }); // YYYY-MM-DD
        const dayOfWeekWib = new Date(targetDate.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' })).getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat

        const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const dayName = dayNames[dayOfWeekWib];

        if (dayOfWeekWib === 0) {
            return {
                date: dateStr,
                dayName,
                isWorkDay: false,
                uniform: 'Hari libur',
                department: null
            };
        }

        // 1. Seragam
        const uniform = routine.uniform_schedule[String(dayOfWeekWib)] || 'Bebas Rapi';

        // 2. Rolling Medsos Story
        // Anchor date: Hari Senin acuan (default: 2026-08-31)
        const anchor = new Date(routine.rotation_anchor_date + 'T00:00:00+07:00');
        const currentTarget = new Date(dateStr + 'T00:00:00+07:00');

        // Cari hari Senin pada pekan target
        const currentMonday = new Date(currentTarget);
        currentMonday.setDate(currentTarget.getDate() - (dayOfWeekWib - 1));

        // Selisih minggu penuh dari anchor Monday
        const diffMs = currentMonday.getTime() - anchor.getTime();
        const diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));

        // Pola rotasi: maju 1 langkah setiap minggu
        const depts = routine.social_media_departments && routine.social_media_departments.length === 3
            ? routine.social_media_departments
            : this.defaultDepartments;

        const weekShift = ((diffWeeks % 3) + 3) % 3;
        const dayOffset = dayOfWeekWib - 1; // 0 = Senin, 1 = Selasa, ..., 5 = Sabtu
        const deptIndex = (weekShift + dayOffset) % 3;
        const department = depts[deptIndex];

        return {
            date: dateStr,
            dayName,
            isWorkDay: true,
            uniform,
            department
        };
    }

    /**
     * Memperbarui satu atau beberapa hari seragam
     */
    async updateUniforms(userId: string, dayMap: Record<string, string>): Promise<Record<string, string>> {
        const routine = await this.getOrCreateWorkRoutine(userId);
        const updated = {
            ...routine.uniform_schedule,
            ...dayMap
        };

        await supabase
            .from('work_routines')
            .update({
                uniform_schedule: updated,
                updated_at: new Date().toISOString()
            })
            .eq('user_id', userId);

        return updated;
    }

    /**
     * Menentukan tanggal target berdasarkan teks pesan user (WIB)
     */
    resolveTargetDate(queryText: string): Date {
        const lower = queryText.toLowerCase();
        // Waktu saat ini di WIB
        const nowWib = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
        const currentDay = nowWib.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat

        if (/lusa/i.test(lower)) {
            const d = new Date(nowWib);
            d.setDate(d.getDate() + 2);
            return d;
        }

        if (/besok/i.test(lower)) {
            const d = new Date(nowWib);
            d.setDate(d.getDate() + 1);
            return d;
        }

        if (/kemarin/i.test(lower)) {
            const d = new Date(nowWib);
            d.setDate(d.getDate() - 1);
            return d;
        }

        const dayKeys: Record<string, number> = {
            'senin': 1,
            'selasa': 2,
            'rabu': 3,
            'kamis': 4,
            'jumat': 5,
            "jum'at": 5,
            'sabtu': 6,
            'minggu': 0
        };

        for (const [dayName, dayNum] of Object.entries(dayKeys)) {
            const dayRegex = new RegExp(`\\b${dayName}\\b`, 'i');
            if (dayRegex.test(lower)) {
                let diffDays = (dayNum - currentDay + 7) % 7;
                if (diffDays === 0 && (/depan/i.test(lower) || /minggu depan/i.test(lower))) {
                    diffDays = 7;
                }
                const target = new Date(nowWib);
                target.setDate(target.getDate() + diffDays);
                return target;
            }
        }

        return nowWib;
    }

    /**
     * Parsing otomatis teks instruksi update seragam dari user WhatsApp
     */
    async parseUniformUpdateText(text: string): Promise<Record<string, string> | null> {
        const dayKeys: Record<string, string> = {
            'senin': '1',
            'selasa': '2',
            'rabu': '3',
            'kamis': '4',
            'jumat': '5',
            "jum'at": '5',
            'sabtu': '6'
        };

        const result: Record<string, string> = {};

        // 1. Cari semua kemunculan nama hari dalam teks
        const dayMatches: { dayNum: string; index: number; length: number }[] = [];
        const regex = /(?:hari\s*)?(senin|selasa|rabu|kamis|jumat|jum\'at|sabtu)\b/gi;
        let m;
        while ((m = regex.exec(text)) !== null) {
            const normalized = m[1].toLowerCase().replace("jum'at", 'jumat');
            if (dayKeys[normalized]) {
                dayMatches.push({
                    dayNum: dayKeys[normalized],
                    index: m.index,
                    length: m[0].length
                });
            }
        }

        // 2. Ekstrak string pakaian di antara hari-hari tersebut
        for (let i = 0; i < dayMatches.length; i++) {
            const current = dayMatches[i];
            const startPos = current.index + current.length;
            const endPos = (i + 1 < dayMatches.length) ? dayMatches[i + 1].index : text.length;

            let outfit = text.substring(startPos, endPos).trim();
            outfit = outfit
                .replace(/^[:=,\-\s]+/, '')
                .replace(/^(?:jadi|adalah)\s*/i, '')
                .replace(/[,;.\s]+$/, '')
                .trim();

            if (outfit.length > 1 && !['hari', 'apa', 'kerja', 'seragam'].includes(outfit.toLowerCase())) {
                result[current.dayNum] = outfit.charAt(0).toUpperCase() + outfit.slice(1);
            }
        }

        if (Object.keys(result).length > 0) {
            return result;
        }

        // 3. Fallback AI jika parsing pola teks bebas
        try {
            const prompt = `Ekstrak daftar seragam harian dari pesan user: "${text}".
Kembalikan HANYA JSON murni:
{
  "1": "Nama Pakaian",
  "2": "Nama Pakaian"
}
Key: 1=Senin, 2=Selasa, 3=Rabu, 4=Kamis, 5=Jumat, 6=Sabtu.
Abaikan hari yang tidak disebutkan.`;
            const raw = await askGemini(prompt);
            let cleaned = raw.trim();
            if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
            if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
            if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);

            const parsed = JSON.parse(cleaned.trim());
            if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
                return parsed;
            }
        } catch (e) {
            console.error('Fallback AI parse uniform failed:', e);
        }

        return null;
    }

    /**
     * Format panduan edit seragam
     */
    getEditUniformGuide(): string {
        return `PANDUAN UBAH SERAGAM KERJA\n` +
            `Ketik dengan format:\n` +
            `ganti seragam [hari] jadi [pakaian]\n\n` +
            `Contoh:\n` +
            `• ganti seragam rabu jadi kaos polo\n` +
            `• senin: batik, selasa: kemeja, rabu: polo`;
    }
}

export const routineService = new RoutineService();
