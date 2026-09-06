'use server';

import { createClient } from '@/lib/supabase/server';
import { GoogleGenAI } from '@google/genai';
import { revalidatePath } from 'next/cache';

// ────────────────────────────────────────────────────────────────
// Helper: Rotasi Multi-API Key Gemini untuk PWA Sandbox
// ────────────────────────────────────────────────────────────────
class PwaApiKeyManager {
    private keys: string[] = [];
    private currentIndex: number = 0;

    constructor() {
        this.reloadKeys();
    }

    reloadKeys() {
        const rawKeys = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
        this.keys = rawKeys.split(',').map(k => k.trim()).filter(Boolean);
    }

    getCurrentKey(): string {
        if (this.keys.length === 0) return '';
        return this.keys[this.currentIndex];
    }

    rotateToNextKey(): string {
        if (this.keys.length <= 1) return this.getCurrentKey();
        this.currentIndex = (this.currentIndex + 1) % this.keys.length;
        console.warn(`🔄 PWA Sandbox Gemini: Beralih ke API Key index [${this.currentIndex + 1}/${this.keys.length}]`);
        return this.getCurrentKey();
    }

    get totalKeys(): number {
        return this.keys.length;
    }
}

const pwaApiKeyManager = new PwaApiKeyManager();

async function callGeminiWithRotation<T>(task: (ai: GoogleGenAI) => Promise<T>): Promise<T> {
    pwaApiKeyManager.reloadKeys();
    let maxAttempts = Math.max(3, pwaApiKeyManager.totalKeys * 2);

    while (maxAttempts > 0) {
        const key = pwaApiKeyManager.getCurrentKey();
        if (!key) throw new Error('GEMINI_API_KEY belum dikonfigurasi di .env.local dashboard');

        try {
            const ai = new GoogleGenAI({ apiKey: key });
            return await task(ai);
        } catch (error: any) {
            const isRateLimitOrOverload = error?.status === 429 || error?.status === 503 || error?.status === 500 ||
                String(error).includes('429') || String(error).includes('503') || String(error).includes('500') ||
                String(error).includes('exceeded your') || String(error).includes('overloaded') || String(error).includes('UNAVAILABLE');

            if (isRateLimitOrOverload && pwaApiKeyManager.totalKeys > 1) {
                console.warn(`⚠️ PWA Sandbox Rate Limit (429/503). Mencoba key berikutnya...`);
                pwaApiKeyManager.rotateToNextKey();
                maxAttempts--;
                await new Promise(res => setTimeout(res, 800));
            } else {
                throw error;
            }
        }
    }
    throw new Error('Semua Gemini API Key kehabisan kuota atau server sibuk.');
}

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────
export interface SimulatedImpact {
    type: string;
    description: string;
    details?: string;
}

export interface SimulationResult {
    reply: string;
    intents: Array<{
        intent: string;
        entities: any;
    }>;
    simulatedImpacts: SimulatedImpact[];
    is_simulated: boolean;
}

export interface TrainingRule {
    id: string;
    user_id: string;
    sample_phrase: string;
    expected_intents: any[];
    explanation_rule?: string;
    is_active: boolean;
    created_at: string;
}

// ────────────────────────────────────────────────────────────────
// Helper: Penentuan Tanggal Target Berdasarkan Teks (WIB)
// ────────────────────────────────────────────────────────────────
function resolveTargetDateFromText(queryText: string): Date {
    const lower = queryText.toLowerCase();
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

// ────────────────────────────────────────────────────────────────
// 1. Format Respon: Rutinitas Kerja & Medsos (QUERY_ROUTINE)
// ────────────────────────────────────────────────────────────────
function formatRoutineReply(workRoutine: any, queryText: string): string {
    const targetDate = resolveTargetDateFromText(queryText);
    const dateStr = targetDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
    const dayOfWeekWib = new Date(targetDate.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' })).getDay();

    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const dayName = dayNames[dayOfWeekWib];

    if (dayOfWeekWib === 0) {
        return `INFORMASI RUTINITAS KERJA (MINGGU)\n• Hari libur (tidak ada seragam kerja dan story medsos)`;
    }

    const defaultUniforms: Record<string, string> = {
        '1': 'Batik',
        '2': 'Kemeja',
        '3': 'Bebas Rapi',
        '4': 'Batik',
        '5': 'Kaos Polo',
        '6': 'Bebas Rapi'
    };
    const defaultDepartments = ['Homeschool', 'TSD', 'Okupasi'];
    const defaultAnchorDate = '2026-08-31';

    const uniforms = workRoutine?.uniform_schedule || defaultUniforms;
    const uniform = uniforms[String(dayOfWeekWib)] || 'Bebas Rapi';

    const anchorDateStr = workRoutine?.rotation_anchor_date || defaultAnchorDate;
    const anchor = new Date(anchorDateStr + 'T00:00:00+07:00');
    const currentTarget = new Date(dateStr + 'T00:00:00+07:00');

    const currentMonday = new Date(currentTarget);
    currentMonday.setDate(currentTarget.getDate() - (dayOfWeekWib - 1));

    const diffMs = currentMonday.getTime() - anchor.getTime();
    const diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));

    const depts = workRoutine?.social_media_departments && workRoutine.social_media_departments.length === 3
        ? workRoutine.social_media_departments
        : defaultDepartments;

    const weekShift = ((diffWeeks % 3) + 3) % 3;
    const dayOffset = dayOfWeekWib - 1;
    const deptIndex = (weekShift + dayOffset) % 3;
    const department = depts[deptIndex];

    let routineMsg = `INFORMASI RUTINITAS KERJA (${dayName.toUpperCase()})\n`;
    routineMsg += `• Seragam: ${uniform}\n`;
    if (department) {
        routineMsg += `• Jadwal Story Instagram: Departemen ${department}`;
    }
    return routineMsg.trim();
}

// ────────────────────────────────────────────────────────────────
// 2. Format Respon: Jadwal Kuliah & Target KB (QUERY_COURSE_SCHEDULE)
// ────────────────────────────────────────────────────────────────
function formatCourseScheduleReply(
    courseSchedules: any[],
    weeklyTargets: any[],
    modules: any[],
    semesterStartDate: string | null,
    queryText: string
): string {
    const targetDate = resolveTargetDateFromText(queryText);
    const day = targetDate.getDay();
    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

    // Hitung current week
    let currentWeek = 1;
    if (semesterStartDate) {
        const sDate = new Date(semesterStartDate);
        const tDate = new Date();
        if (tDate >= sDate) {
            const diffTime = Math.abs(tDate.getTime() - sDate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            currentWeek = Math.floor(diffDays / 7) + 1;
        }
    }

    const daySchedules = (courseSchedules || [])
        .filter(s => s.day_of_week === day)
        .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));

    let msg = `JADWAL KULIAH (${dayNames[day].toUpperCase()} • MINGGU KE-${currentWeek}):\n`;
    if (daySchedules.length > 0) {
        for (const s of daySchedules) {
            const start = s.start_time ? s.start_time.slice(0, 5) : '00:00';
            const end = s.end_time ? s.end_time.slice(0, 5) : '00:00';
            msg += `• ${start}-${end}: ${s.subject_name}`;
            if (s.room) msg += ` (${s.room})`;

            // Ambil target materi spesifik minggu ini
            const target = (weeklyTargets || []).find(
                t => t.week_number === currentWeek &&
                     t.subject_name &&
                     t.subject_name.toLowerCase().includes(s.subject_name.toLowerCase())
            );

            const linkedMods = (modules || []).filter(
                m => m.week_number === currentWeek &&
                     m.subject_name &&
                     m.subject_name.toLowerCase().includes(s.subject_name.toLowerCase())
            );

            if (target?.topic) {
                msg += `\n  🎯 Target: ${target.topic}`;
                if (target.is_completed) msg += ` (Selesai)`;
            } else if (linkedMods.length > 0) {
                const kbTitles = linkedMods.map((m: any) => m.kb_title).join(', ');
                msg += `\n  🎯 Target KB: ${kbTitles}`;
            }
            msg += '\n';
        }
    } else {
        msg += `Libur / Tidak ada jadwal kuliah.`;
    }

    return msg.trim();
}

// ────────────────────────────────────────────────────────────────
// 3. Format Respon: Progres Materi Kuliah (QUERY_COURSE_PROGRESS)
// ────────────────────────────────────────────────────────────────
function formatCourseProgressReply(weeklyTargets: any[]): string {
    if (!weeklyTargets || weeklyTargets.length === 0) {
        return "Belum ada data target belajar yang dicatat.";
    }

    const stats: Record<string, { total: number; done: number }> = {};
    for (const item of weeklyTargets) {
        const sub = item.subject_name || 'Matkul';
        if (!stats[sub]) stats[sub] = { total: 0, done: 0 };
        stats[sub].total++;
        if (item.is_completed) stats[sub].done++;
    }

    let reply = "PROGRES MATERI KULIAH:\n";
    for (const [sub, st] of Object.entries(stats)) {
        const pct = Math.round((st.done / st.total) * 100);
        reply += `• ${sub}: ${st.done}/${st.total} materi (${pct}%)\n`;
    }
    return reply.trim();
}

// ────────────────────────────────────────────────────────────────
// 4. Format Respon: Jadwal Terapi Anak TSD & OT (QUERY_THERAPY_SCHEDULE)
// ────────────────────────────────────────────────────────────────
function formatTherapyScheduleReply(therapySchedules: any[], queryText: string): string {
    const lower = queryText.toLowerCase();
    const isCurrentSessionQuery = /sekarang|saat ini|lagi sesi/i.test(lower);

    const nowWib = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
    let targetDay = nowWib.getDay();

    if (/besok/i.test(lower)) targetDay = (targetDay + 1) % 7;
    else if (/senin/i.test(lower)) targetDay = 1;
    else if (/selasa/i.test(lower)) targetDay = 2;
    else if (/rabu/i.test(lower)) targetDay = 3;
    else if (/kamis/i.test(lower)) targetDay = 4;
    else if (/jumat|jum'at/i.test(lower)) targetDay = 5;
    else if (/sabtu/i.test(lower)) targetDay = 6;
    else if (/minggu/i.test(lower)) targetDay = 0;

    if (targetDay === 0) {
        return "Hari Minggu tidak ada jadwal terapi (libur).";
    }

    let deptFilter: 'TSD' | 'OT' | undefined = undefined;
    if (/tsd/i.test(lower) && !/okupasi|ot/i.test(lower)) deptFilter = 'TSD';
    if ((/okupasi|ot/i.test(lower)) && !/tsd/i.test(lower)) deptFilter = 'OT';

    const dayNames = ['', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
    const dayLabel = dayNames[targetDay];

    const parseMinutes = (range: string) => {
        const m = range.replace(':', '.').match(/^(\d{1,2})[.](\d{2})/);
        if (!m) return 0;
        return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
    };

    let allItems = (therapySchedules || [])
        .filter(i => i.day_of_week === targetDay && (!deptFilter || i.department === deptFilter))
        .sort((a, b) => parseMinutes(a.time_range) - parseMinutes(b.time_range));

    if (allItems.length === 0) {
        return `Belum ada jadwal terapi yang tersimpan untuk hari ${dayLabel}.`;
    }

    if (isCurrentSessionQuery && targetDay === nowWib.getDay()) {
        const currentHourMin = nowWib.getHours() * 60 + nowWib.getMinutes();
        const timeStr = `${String(nowWib.getHours()).padStart(2, '0')}:${String(nowWib.getMinutes()).padStart(2, '0')}`;

        const isInside = (rangeStr: string) => {
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
            res += `• Sesi TSD (${ongoingTsd[0].time_range}):\n`;
            for (const item of ongoingTsd) {
                res += `    - ${item.child_name}${item.therapist_initial ? `-${item.therapist_initial}` : ''}\n`;
            }
        }
        if (ongoingOt.length > 0) {
            res += `• Sesi OT (${ongoingOt[0].time_range}):\n`;
            for (const item of ongoingOt) {
                res += `    - ${item.child_name}\n`;
            }
        }
        return res.trim();
    }

    let res = `JADWAL TERAPI ${dayLabel}:\n`;
    const sessions = Array.from(new Set(allItems.map(i => `${i.department}__${i.time_range}__${i.session_number}`)));
    for (const sessKey of sessions) {
        const [dept, timeRange, sessNum] = sessKey.split('__');
        const items = allItems.filter(i => i.department === dept && i.time_range === timeRange);
        res += `• ${dept} ${sessNum && sessNum !== '0' && sessNum !== 'null' ? `Sesi ${sessNum}` : ''} (${timeRange}):\n`;
        for (const it of items) {
            res += `    - ${it.child_name}${it.therapist_initial ? `-${it.therapist_initial}` : ''}\n`;
        }
    }
    return res.trim();
}

// ────────────────────────────────────────────────────────────────
// 5. Format Respon: Pertanyaan Keuangan Lengkap (QUERY_FINANCE)
// ────────────────────────────────────────────────────────────────
async function formatFinanceQueryReply(context: any, queryText: string): Promise<string> {
    const prompt = `
Kamu asisten pribadi yang menjawab pertanyaan user tentang keuangan, tugas, dan jadwal secara ringkas, akurat, dan rapi.

DATA PRIBADI USER (real-time dari database, waktu saat ini: ${new Date().toISOString()}):
${JSON.stringify(context, null, 2)}

Pertanyaan user: "${queryText}"

ATURAN STRICT MENJAWAB (HARUS PATUH):
1. **DILARANG MENGGUNAKAN EMOJI / EMOTICON SAMA SEKALI (0 EMOJI).**
2. **FORMAT LIST**: Setiap item HARUS berbaris sendiri diawali simbol bullet (• ). DILARANG memisahkan item dengan koma dalam 1 baris.
3. **PISAHKAN TIAP KATEGORI DENGAN TEPAT 1 BARIS KOSONG (ENTER DUA KALI / \\n\\n)** agar ada jeda antar blok kategori.
   CONTOH FORMAT PERSIS:
   SALDO REKENING:
   • Total Saldo: Rp 5.000.000
   • Teralokasi ke Tabungan: Rp 1.000.000
   • Saldo Bebas (Bisa Dipakai): Rp 4.000.000
   • Bank Jago: Rp 3.000.000
   • Cash: Rp 2.000.000

   HUTANG:
   • Kakek: sisa Rp 6.000.000

   PIUTANG:
   • Dian: sisa Rp 150.000

   BUDGET:
   • Jajan: sisa Rp 9.000 dari limit Rp 100.000

   TARGET MENABUNG:
   • MacBook M1 Pro: Rp 2.500.000 dari target Rp 16.000.000

4. **WAKTU / JAM**: Selalu tampilkan waktu dalam zona waktu lokal (WIB), jangan sebut "UTC".
5. **DILARANG BASA-BASI**: Tanpa salam pembuka ("Halo!", "Tentu!"), tanpa penutup ("Ada lagi?", "Semoga membantu!").
6. **JANGAN POTONG DETAIL**: Tampilkan rincian angka lengkap.
7. Jika data kategori tertentu kosong/tidak ada, lewati saja jangan dicantumkan.
8. Jangan sebut nama "Karen".
`;

    return await callGeminiWithRotation(async (ai) => {
        const response = await ai.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: prompt,
            config: {
                temperature: 0.1
            }
        });
        return (response.text || '').trim();
    });
}

// ────────────────────────────────────────────────────────────────
// 6. Format Respon: Agenda Tugas & Jadwal Rutin (QUERY_AGENDA)
// ────────────────────────────────────────────────────────────────
async function formatAgendaReply(tasks: any[], schedules: any[], queryText: string): Promise<string> {
    const dataContext = {
        currentTime: new Date().toISOString(),
        pendingTasks: tasks || [],
        regularSchedules: schedules || []
    };

    const prompt = `
Kamu adalah asisten pribadi yang menjawab pertanyaan user seputar tugas dan jadwal agenda.

DATA JADWAL DAN TUGAS USER (waktu saat ini: ${new Date().toISOString()}):
\`\`\`json
${JSON.stringify(dataContext, null, 2)}
\`\`\`

Pertanyaan user: "${queryText}"

ATURAN STRICT MENJAWAB (HARUS PATUH):
1. **DILARANG MENGGUNAKAN EMOJI / EMOTICON SAMA SEKALI (0 EMOJI).**
2. **FORMAT LIST**: Setiap item HARUS berbaris sendiri diawali simbol bullet (• ). DILARANG memisahkan item dengan koma dalam 1 baris.
3. **PISAHKAN TIAP KATEGORI DENGAN TEPAT 1 BARIS KOSONG (ENTER DUA KALI / \\n\\n)** agar ada jeda antar blok kategori (misal: JADWAL HARI INI:, TUGAS URGENT:, DEADLINE BESOK:).
4. **WAKTU / JAM**: Selalu gunakan waktu dalam format WIB (Waktu Indonesia Barat), jangan pernah menulis "UTC".
5. **URUTAN URGENT**: Urutkan daftar tugas dari yang paling urgent (due date terdekat / prioritas HIGH di atas).
6. **DILARANG BASA-BASI**: Tanpa salam pembuka atau penutup.
7. **JANGAN POTONG DETAIL**: Sebutkan rincian lengkap tugas atau jadwal sesuai data.
8. Jangan sebut nama "Karen".
`;

    return await callGeminiWithRotation(async (ai) => {
        const response = await ai.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: prompt,
            config: {
                temperature: 0.1
            }
        });
        return (response.text || '').trim();
    });
}

// ────────────────────────────────────────────────────────────────
// Action Utama: Simulasi Chat Karen (Dry-Run dengan Data Asli Lengkap)
// ────────────────────────────────────────────────────────────────
export async function simulateKarenChat(
    message: string,
    history: Array<{ sender: 'user' | 'assistant'; text: string }> = []
): Promise<SimulationResult> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User belum login');

    // 1. Tarik seluruh konteks data asli pengguna (Read-Only)
    const [
        accountsRes,
        goalsRes,
        tasksRes,
        debtsRes,
        budgetsRes,
        studySchedulesRes,
        userSettingsRes,
        workRoutinesRes,
        courseSchedulesRes,
        courseTargetsRes,
        courseModulesRes,
        therapySchedulesRes,
        rulesRes
    ] = await Promise.all([
        supabase.from('bank_accounts').select('*').eq('user_id', user.id),
        supabase.from('goals').select('*').eq('user_id', user.id).eq('status', 'IN_PROGRESS'),
        supabase.from('tasks').select('*').eq('user_id', user.id).in('status', ['TODO', 'IN_PROGRESS']).order('due_date', { ascending: true, nullsFirst: false }),
        supabase.from('debts').select('*').eq('user_id', user.id).in('status', ['UNPAID', 'PARTIAL']),
        supabase.from('budgets').select('amount, transaction_categories(name)').eq('user_id', user.id),
        supabase.from('study_schedules').select('*').eq('user_id', user.id).order('day_of_week', { ascending: true }),
        supabase.from('user_settings').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('work_routines').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('course_schedules').select('*').eq('user_id', user.id).order('day_of_week', { ascending: true }),
        supabase.from('course_weekly_targets').select('*').eq('user_id', user.id).order('week_number', { ascending: true }),
        supabase.from('course_modules').select('*').eq('user_id', user.id),
        supabase.from('therapy_schedules').select('*').eq('user_id', user.id),
        supabase.from('ai_training_rules').select('*').eq('user_id', user.id).eq('is_active', true).order('created_at', { ascending: true })
    ]);

    const accounts = accountsRes.data || [];
    const goals = goalsRes.data || [];
    const tasks = tasksRes.data || [];
    const debts = debtsRes.data || [];
    const budgets = budgetsRes.data || [];
    const studySchedules = studySchedulesRes.data || [];
    const userSettings = userSettingsRes.data;
    const workRoutines = workRoutinesRes.data;
    const courseSchedules = courseSchedulesRes.data || [];
    const courseTargets = courseTargetsRes.data || [];
    const courseModules = courseModulesRes.data || [];
    const therapySchedules = therapySchedulesRes.data || [];
    const rules = rulesRes.data || [];

    // Hitung ringkasan saldo keuangan
    const totalBankBalance = accounts.reduce((sum, acc) => sum + Number(acc.balance || 0), 0);
    const totalGoalAllocation = goals.reduce((sum, g) => sum + Number(g.current_amount || 0), 0);
    const freeBalance = totalBankBalance - totalGoalAllocation;

    // 2. Susun ringkasan konteks nyata
    const accountsContext = accounts.length > 0
        ? accounts.map(a => `${a.name}: Rp ${Number(a.balance).toLocaleString('id-ID')}`).join(', ')
        : 'Cash: Rp 0';

    const goalsContext = goals.length > 0
        ? goals.map(g => `${g.name} (Terkumpul Rp ${Number(g.current_amount).toLocaleString('id-ID')} / Target Rp ${Number(g.target_amount).toLocaleString('id-ID')})`).join(', ')
        : 'Belum ada tabungan';

    const tasksContext = tasks.length > 0
        ? tasks.map(t => `${t.title} [${t.status}]`).join(', ')
        : 'Tidak ada tugas aktif';

    // 3. Susun aturan kustom dinamis (Few-Shot Injection)
    let customRulesSection = '';
    if (rules.length > 0) {
        customRulesSection = `\n=== ATURAN PELATIHAN KUSTOM DARI USER (PRIORITAS TINGGI) ===\n`;
        rules.forEach((r: any, idx: number) => {
            customRulesSection += `${idx + 1}. Contoh Perintah: "${r.sample_phrase}"\n`;
            if (r.explanation_rule) customRulesSection += `   Aturan: ${r.explanation_rule}\n`;
            customRulesSection += `   Expected Intents: ${JSON.stringify(r.expected_intents)}\n`;
        });
        customRulesSection += `============================================================\n`;
    }

    const now = new Date();
    const currentTimeStr = `${now.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} (WIB), ISO: ${now.toISOString()}`;
    const formattedHistory = history.map(h => `${h.sender === 'user' ? 'User' : 'Karen'}: ${h.text}`).join('\n');

    // 4. System Prompt Resmi Karen WhatsApp
    const systemPrompt = `
Namamu adalah "Karen". Kamu asisten pribadi yang jalan di WhatsApp.
Tugas utamamu: analisis pesan user, deteksi "Intent", ekstrak entitas penting, dan beri balasan — semua dalam satu JSON.
Kamu akan menerima [Riwayat Percakapan] sebagai konteks. Gunakan itu untuk memahami pesan terakhir secara utuh, termasuk kalau user revisi pesan sebelumnya.
Mata uang default: IDR.

Daftar Intent:
1. ADD_EXPENSE : mencatat pengeluaran ("habis makan 45rb", "bayar bensin 80k")
2. ADD_INCOME : mencatat pemasukan ("gaji masuk 5jt", "dapet transfer 200rb")
3. SET_BALANCE : set/update saldo rekening ("saldo Jago 5jt", "aku ada 3jt di BSI dan 5jt di Jago")
4. SET_BUDGET : atur limit anggaran per kategori ("budget makan 1 juta sebulan")
5. ADD_DEBT : user berhutang ke orang lain ("pinjam ke Budi 500rb", "ngutang warung 50rb")
6. ADD_RECEIVABLE : orang lain berhutang/tukar uang cash ke user ("Andi pinjam 200rb", "kasi pinjam Budi 100rb", "si A tuker cash ke aku 50k")
7. PAY_DEBT : pelunasan hutang/piutang ("Budi bayar 200rb", "aku bayar ke Budi 300rb", "dia bayar ke seabank 50k")
8. DELETE_DEBT : membatalkan/menghapus catatan hutang/piutang yang salah ("hapus utang dian", "batalin piutang budi")
9. DELETE_TRANSACTION : menghapus riwayat pengeluaran atau pemasukan ("hapus transaksi makan 50k", "hapus pengeluaran 37k", "batalin transaksi 100rb", "hapus riwayat transaksi bensin")
10. CREATE_GOAL : bikin target tabungan baru ("mau nabung beli laptop 8jt", "target HP baru 3jt")
11. TOPUP_GOAL : nabung ke target yang sudah ada ("masukkan 500rb ke tabungan laptop", "tabung 1jt buat HP dari BCA")
12. DELETE_GOAL : menghapus target tabungan ("hapus tabungan laptop", "batal target HP", "delete goal pcx")
13. QUERY_FINANCE : tanya soal keuangan ("berapa saldo BCA?", "sisa budget makan?", "siapa aja yang utang ke aku?")
14. ADD_TASK : membuat catatan tugas / to-do list ("ingetin besok jam 10 kumpul tugas web", "catat besok beli galon")
15. COMPLETE_TASK : menandai tugas sudah selesai ("tugas web udah kelar", "beli galon done")
16. UPDATE_TASK_PROGRESS : update progres/tahap pengerjaan tugas ke tahap In Progress ("tugas web lagi ngerjain bab 1", "tugas makalah in progress bikin kuesioner", "update progres tugas frontend sampai responsive")
17. DELETE_TASK : menghapus catatan tugas ("hapus tugas web", "batal beli galon")
18. ADD_SCHEDULE : membuat jadwal kegiatan rutin ("jadwal meeting tiap kamis jam 9")
19. DELETE_SCHEDULE : menghapus jadwal rutin ("hapus jadwal meeting kamis")
20. QUERY_AGENDA : tanya jadwal rutin atau tugas hari ini/besok ("hari ini jadwalku apa aja?", "besok ada tugas ga?")
21. ADD_REMINDER : menyetel alarm/pengingat di jam tertentu baik bebas maupun terkait tugas ("nanti jam 10 ingatkan telepon mama", "ingetin jam 8 malam tugas web", "ingatkan besok jam 7 pagi ada meeting")
22. RESCHEDULE_REMINDER : menjadwalkan ulang / mengundur pengingat yang sudah ada ("undur pengingat telepon mama jadi jam 16:00", "reschedule reminder tugas web ke besok jam 8", "tunda pengingat 1 jam lagi")
23. DELETE_REMINDER : membatalkan/menghapus pengingat ("batalkan pengingat telepon mama", "hapus reminder tugas web")
24. UPDATE_LAST_TRANSACTION : mengubah data transaksi terakhir yang baru saja dicatat ("eh salah, ganti jadi 36k", "yang barusan salah, nominalnya 40rb")
25. CANCEL_LAST_TRANSACTION : membatalkan/menghapus transaksi terakhir ("batalin transaksi yang tadi", "hapus yang barusan")
26. QUERY_ROUTINE : tanya seragam kerja atau giliran story medsos ("hari ini seragam apa?", "besok pake baju apa?", "hari ini giliran departemen apa?", "story ig hari ini departemen apa?", "jadwal medsos hari ini")
27. UPDATE_ROUTINE : ubah / edit seragam kerja ("edit seragam kerja", "ganti seragam rabu jadi kaos polo", "ubah seragam senin batik")
28. QUERY_THERAPY_SCHEDULE : tanya jadwal terapi anak TSD & OT ("jadwal terapi hari ini", "jadwal terapi senin", "sekarang tsd siapa aja?", "sekarang okupasi siapa?", "jadwal tsd hari ini", "sesi 1 hari ini siapa aja?")
29. SET_SEMESTER_START : atur tanggal mulai semester perkuliahan ("semester mulai 14 Juli", "Karen, semester ganjil mulai 1 September")
30. QUERY_COURSE_SCHEDULE : tanya jadwal kuliah ("hari ini kuliah apa aja?", "jadwal kuliah senin?")
31. ADD_COURSE_TARGET : tambah target/materi perkuliahan mingguan ("materi web minggu ini tentang REST API", "target PKK minggu 5: manajemen proyek")
32. COMPLETE_COURSE_WEEK : tandai target materi/kuliah mingguan selesai ("materi web minggu ini udah kelar", "selesai belajar BD minggu 3")
33. QUERY_COURSE_PROGRESS : tanya progres materi kuliah secara keseluruhan ("progres kuliah gimana?", "udah sampai mana materi web?")
34. CHITCHAT : obrolan biasa, salam, pertanyaan di luar keuangan/produktivitas
35. UNKNOWN : pesan tidak dipahami

KONTEKS DATA PENGGUNA SAAT INI:
- Rekening: ${accountsContext}
- Target Tabungan: ${goalsContext}
- Tugas Aktif: ${tasksContext}

${customRulesSection}

ATURAN PENTING untuk field "reply":
- Singkat banget, 1-2 kalimat max. Langsung ke intinya, casual/santai.
- JANGAN sebut nama "Karen".
- DILARANG MENGGUNAKAN EMOJI SAMA SEKALI (0 EMOJI).
- Khusus QUERY_FINANCE, QUERY_AGENDA, QUERY_ROUTINE, QUERY_THERAPY_SCHEDULE, QUERY_COURSE_SCHEDULE, dan QUERY_COURSE_PROGRESS: KOSONGKAN field "reply" ("") jika itu satu-satunya intent, karena data akan ditarik langsung dari service database.
- Untuk konfirmasi mutasi transaksi/tugas: format "oke, [tindakan singkat]" atau langsung keterangan.
- Untuk UNKNOWN: "ga ngerti maksudnya, bisa jelasin?"

OUTPUT: JSON valid, TANPA markdown backticks:
{
  "intents": [
    {
      "intent": "NAMA_INTENT",
      "entities": {
        "amount": number | null,
        "currency": string | null,
        "person_name": string | null,
        "goal_name": string | null,
        "category": string | null,
        "account": string | null,
        "description": string | null,
        "task_name": string | null,
        "subject_name": string | null,
        "due_date": string | null,
        "day_of_week": number | null,
        "start_time": string | null,
        "end_time": string | null,
        "week_number": number | null,
        "semester_start_date": string | null
      }
    }
  ],
  "reply": "teks balasan"
}
`;

    const userPrompt = `
WAKTU REAL-TIME SAAT INI: ${currentTimeStr}

=== RIWAYAT CHAT SIMULASI ===
${formattedHistory}
=============================

Pesan User: "${message}"

Analisis pesan di atas dan kembalikan JSON.
`;

    // 5. Panggil Gemini AI untuk Deteksi Intent
    const rawOutput = await callGeminiWithRotation(async (ai) => {
        const response = await ai.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: userPrompt,
            config: {
                systemInstruction: systemPrompt,
                temperature: 0.1,
            }
        });
        return response.text || '{}';
    });

    const cleanJson = rawOutput.replace(/```json/gi, '').replace(/```/gi, '').trim();
    let parsed: any;
    try {
        parsed = JSON.parse(cleanJson);
    } catch {
        parsed = {
            intents: [{ intent: 'UNKNOWN', entities: {} }],
            reply: 'Maaf, format balasan AI tidak terurai dengan benar.'
        };
    }

    const detectedIntents = Array.isArray(parsed.intents) ? parsed.intents : [];
    let reply = parsed.reply || '';

    // 6. Integrasi Query Jawaban Otomatis (Live Read-Only Data)
    const isSingleIntent = detectedIntents.length === 1;

    for (const item of detectedIntents) {
        const intent = item.intent;

        if (intent === 'QUERY_FINANCE') {
            const financeContext = {
                summary: {
                    total_bank_balance: totalBankBalance,
                    total_allocated_to_goals: totalGoalAllocation,
                    free_balance_usable: freeBalance
                },
                accounts: accounts.map(a => ({ name: a.name, currency: a.currency || 'IDR', balance: a.balance })),
                active_debts_receivables: debts.map(d => ({
                    person: d.person_name,
                    type: d.type === 'PAYABLE' ? 'Hutangku (Aku harus bayar ke dia)' : 'Piutangku (Dia harus bayar ke aku)',
                    total_amount: d.amount,
                    remaining_amount: d.remaining_amount,
                    currency: d.currency || 'IDR'
                })),
                current_budgets: budgets.map((b: any) => ({
                    category: b.transaction_categories?.name || 'Umum',
                    limit_amount: b.amount
                })),
                goals: goals.map(g => ({
                    name: g.name,
                    target: g.target_amount,
                    current: g.current_amount
                }))
            };

            const financeAnswer = await formatFinanceQueryReply(financeContext, message);
            if (isSingleIntent) reply = financeAnswer;
            else reply = reply ? `${reply}\n\n${financeAnswer}` : financeAnswer;
        }

        if (intent === 'QUERY_COURSE_SCHEDULE') {
            const courseAnswer = formatCourseScheduleReply(
                courseSchedules,
                courseTargets,
                courseModules,
                userSettings?.semester_start_date || null,
                message
            );
            if (isSingleIntent) reply = courseAnswer;
            else reply = reply ? `${reply}\n\n${courseAnswer}` : courseAnswer;
        }

        if (intent === 'QUERY_COURSE_PROGRESS') {
            const progressAnswer = formatCourseProgressReply(courseTargets);
            if (isSingleIntent) reply = progressAnswer;
            else reply = reply ? `${reply}\n\n${progressAnswer}` : progressAnswer;
        }

        if (intent === 'QUERY_ROUTINE') {
            const routineAnswer = formatRoutineReply(workRoutines, message);
            if (isSingleIntent) reply = routineAnswer;
            else reply = reply ? `${reply}\n\n${routineAnswer}` : routineAnswer;
        }

        if (intent === 'QUERY_THERAPY_SCHEDULE') {
            const therapyAnswer = formatTherapyScheduleReply(therapySchedules, message);
            if (isSingleIntent) reply = therapyAnswer;
            else reply = reply ? `${reply}\n\n${therapyAnswer}` : therapyAnswer;
        }

        if (intent === 'QUERY_AGENDA') {
            const agendaAnswer = await formatAgendaReply(tasks, studySchedules, message);
            if (isSingleIntent) reply = agendaAnswer;
            else reply = reply ? `${reply}\n\n${agendaAnswer}` : agendaAnswer;
        }
    }

    // 7. Hitung Dampak Simulasi Virtual (Dry-Run / Tanpa Mutasi DB)
    const simulatedImpacts: SimulatedImpact[] = [];

    for (const item of detectedIntents) {
        const intent = item.intent;
        const ent = item.entities || {};

        if (intent === 'ADD_EXPENSE') {
            const accName = ent.account || (accounts[0]?.name || 'Cash');
            const targetAcc = accounts.find(a => a.name.toLowerCase() === accName.toLowerCase()) || accounts[0];
            const nominal = Number(ent.amount) || 0;
            const curBal = targetAcc ? Number(targetAcc.balance) : 0;
            const newBal = curBal - nominal;

            simulatedImpacts.push({
                type: 'Pengeluaran (Expense)',
                description: `Mencatat pengeluaran '${ent.description || ent.category || 'Belanja'}' sebesar Rp ${nominal.toLocaleString('id-ID')}`,
                details: targetAcc
                    ? `[Simulasi Rekening ${targetAcc.name}]: Rp ${curBal.toLocaleString('id-ID')} → Rp ${newBal.toLocaleString('id-ID')} (-Rp ${nominal.toLocaleString('id-ID')})`
                    : `Rekening ${accName} berkurang Rp ${nominal.toLocaleString('id-ID')}`
            });
        } else if (intent === 'ADD_INCOME') {
            const accName = ent.account || (accounts[0]?.name || 'Cash');
            const targetAcc = accounts.find(a => a.name.toLowerCase() === accName.toLowerCase()) || accounts[0];
            const nominal = Number(ent.amount) || 0;
            const curBal = targetAcc ? Number(targetAcc.balance) : 0;
            const newBal = curBal + nominal;

            simulatedImpacts.push({
                type: 'Pemasukan (Income)',
                description: `Mencatat pemasukan '${ent.description || 'Pemasukan'}' sebesar Rp ${nominal.toLocaleString('id-ID')}`,
                details: targetAcc
                    ? `[Simulasi Rekening ${targetAcc.name}]: Rp ${curBal.toLocaleString('id-ID')} → Rp ${newBal.toLocaleString('id-ID')} (+Rp ${nominal.toLocaleString('id-ID')})`
                    : `Rekening ${accName} bertambah Rp ${nominal.toLocaleString('id-ID')}`
            });
        } else if (intent === 'SET_BALANCE') {
            const accName = ent.account || (accounts[0]?.name || 'Cash');
            const targetAcc = accounts.find(a => a.name.toLowerCase() === accName.toLowerCase()) || accounts[0];
            const nominal = Number(ent.amount) || 0;
            simulatedImpacts.push({
                type: 'Pembaruan Saldo (Set Balance)',
                description: `Mengatur saldo rekening '${targetAcc ? targetAcc.name : accName}' menjadi Rp ${nominal.toLocaleString('id-ID')}`,
                details: targetAcc ? `Saldo lama: Rp ${Number(targetAcc.balance).toLocaleString('id-ID')} → Saldo baru: Rp ${nominal.toLocaleString('id-ID')}` : undefined
            });
        } else if (intent === 'ADD_TASK') {
            simulatedImpacts.push({
                type: 'Tugas Baru (To Do)',
                description: `Menambahkan tugas '${ent.task_name || ent.description || 'Tugas Baru'}' ke kolom To Do Kanban`,
                details: ent.due_date ? `Tenggat waktu: ${new Date(ent.due_date).toLocaleString('id-ID')}` : 'Tanpa tenggat waktu khusus'
            });
        } else if (intent === 'COMPLETE_TASK') {
            simulatedImpacts.push({
                type: 'Penyelesaian Tugas',
                description: `Menandai tugas '${ent.task_name || ent.description || 'Tugas'}' menjadi Selesai (DONE)`,
                details: 'Status tugas di Kanban berpindah ke kolom Selesai'
            });
        } else if (intent === 'UPDATE_TASK_PROGRESS') {
            simulatedImpacts.push({
                type: 'Update Progres Tugas',
                description: `Memindahkan tugas '${ent.task_name || 'Tugas'}' ke In Progress dengan catatan progres`,
                details: ent.description ? `Catatan: ${ent.description}` : 'Tahap pengerjaan diperbarui'
            });
        } else if (intent === 'ADD_REMINDER') {
            simulatedImpacts.push({
                type: 'Pengingat (Reminder)',
                description: `Menjadwalkan alarm pengingat '${ent.description || 'Pengingat'}'`,
                details: ent.due_date ? `Jatuh tempo: ${new Date(ent.due_date).toLocaleString('id-ID')}` : 'Waktu relatif'
            });
        } else if (intent === 'ADD_RECEIVABLE') {
            simulatedImpacts.push({
                type: 'Pemberian Piutang / Tukar Uang',
                description: `Mencatat piutang atas nama '${ent.person_name || 'Teman'}' sebesar Rp ${(Number(ent.amount) || 0).toLocaleString('id-ID')}`,
                details: `Saldo kas/rekening berkurang Rp ${(Number(ent.amount) || 0).toLocaleString('id-ID')} dan catatan piutang dibuat`
            });
        } else if (intent === 'ADD_DEBT') {
            simulatedImpacts.push({
                type: 'Penerimaan Pinjaman (Hutang)',
                description: `Mencatat hutang ke '${ent.person_name || 'Teman'}' sebesar Rp ${(Number(ent.amount) || 0).toLocaleString('id-ID')}`,
                details: `Saldo kas/rekening bertambah Rp ${(Number(ent.amount) || 0).toLocaleString('id-ID')} dan catatan hutang dibuat`
            });
        } else if (intent === 'PAY_DEBT') {
            simulatedImpacts.push({
                type: 'Pelunasan Hutang/Piutang',
                description: `Pelunasan dari/ke '${ent.person_name || 'Orang'}' sebesar Rp ${(Number(ent.amount) || 0).toLocaleString('id-ID')}`,
                details: ent.account ? `Saldo rekening ${ent.account} disesuaikan` : 'Status hutang diupdate'
            });
        } else if (intent === 'TOPUP_GOAL') {
            simulatedImpacts.push({
                type: 'Setor Tabungan (Goal)',
                description: `Menambah tabungan target '${ent.goal_name || 'Goal'}' sebesar Rp ${(Number(ent.amount) || 0).toLocaleString('id-ID')}`,
                details: 'Alokasi tabungan bertambah dan saldo bebas disesuaikan'
            });
        } else if (intent === 'CREATE_GOAL') {
            simulatedImpacts.push({
                type: 'Target Tabungan Baru',
                description: `Membuat target tabungan '${ent.goal_name || 'Tabungan Baru'}' dengan target Rp ${(Number(ent.amount) || 0).toLocaleString('id-ID')}`
            });
        } else if (intent === 'SET_SEMESTER_START') {
            simulatedImpacts.push({
                type: 'Tanggal Mulai Semester',
                description: `Mengatur tanggal awal semester menjadi ${ent.semester_start_date || 'tanggal yang ditentukan'}`,
                details: 'Penghitungan minggu perkuliahan otomatis berpatokan pada tanggal ini'
            });
        } else if (intent === 'ADD_COURSE_TARGET') {
            simulatedImpacts.push({
                type: 'Target Silabus Kuliah',
                description: `Menambahkan target materi minggu ke-${ent.week_number || 'N'} untuk matkul '${ent.subject_name || 'Matkul'}'`,
                details: ent.description ? `Materi: ${ent.description}` : undefined
            });
        } else if (intent === 'COMPLETE_COURSE_WEEK') {
            simulatedImpacts.push({
                type: 'Selesai Belajar Silabus',
                description: `Menandai materi minggu ke-${ent.week_number || 'N'} matkul '${ent.subject_name || 'Matkul'}' selesai`,
                details: 'Persentase progres silabus semester bertambah'
            });
        } else if (intent === 'UPDATE_ROUTINE') {
            simulatedImpacts.push({
                type: 'Pembaruan Seragam Kerja',
                description: 'Memperbarui konfigurasi seragam kerja mingguan di tabel work_routines'
            });
        } else if (intent === 'DELETE_TRANSACTION' || intent === 'CANCEL_LAST_TRANSACTION') {
            simulatedImpacts.push({
                type: 'Pembatalan Transaksi (Rollback)',
                description: 'Membatalkan pencatatan transaksi dan mengembalikan saldo rekening ke kondisi semula'
            });
        }
    }

    return {
        reply,
        intents: detectedIntents,
        simulatedImpacts,
        is_simulated: true
    };
}

// ────────────────────────────────────────────────────────────────
// Action: Simpan Aturan Training Baru (Few-Shot Rule)
// ────────────────────────────────────────────────────────────────
export async function saveTrainingRule(
    samplePhrase: string,
    expectedIntents: any[],
    explanationRule?: string
) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User belum login');

    const { data, error } = await supabase.from('ai_training_rules').insert({
        user_id: user.id,
        sample_phrase: samplePhrase.trim(),
        expected_intents: expectedIntents,
        explanation_rule: explanationRule ? explanationRule.trim() : null,
        is_active: true
    }).select().single();

    if (error) throw new Error(`Gagal menyimpan aturan: ${error.message}`);
    revalidatePath('/sandbox');
    return data;
}

// ────────────────────────────────────────────────────────────────
// Action: Ambil Daftar Aturan Training
// ────────────────────────────────────────────────────────────────
export async function getTrainingRules(): Promise<TrainingRule[]> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
        .from('ai_training_rules')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching training rules:', error);
        return [];
    }
    return data || [];
}

// ────────────────────────────────────────────────────────────────
// Action: Toggle Status Aktif Aturan
// ────────────────────────────────────────────────────────────────
export async function toggleTrainingRule(id: string, isActive: boolean) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User belum login');

    const { error } = await supabase
        .from('ai_training_rules')
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id);

    if (error) throw new Error(error.message);
    revalidatePath('/sandbox');
}

// ────────────────────────────────────────────────────────────────
// Action: Hapus Aturan Training
// ────────────────────────────────────────────────────────────────
export async function deleteTrainingRule(id: string) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User belum login');

    const { error } = await supabase
        .from('ai_training_rules')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

    if (error) throw new Error(error.message);
    revalidatePath('/sandbox');
}
