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
// Action: Simulasi Chat Karen (Dry-Run dengan Data Asli Sebagai Patokan)
// ────────────────────────────────────────────────────────────────
export async function simulateKarenChat(
    message: string,
    history: Array<{ sender: 'user' | 'assistant'; text: string }> = []
): Promise<SimulationResult> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User belum login');

    // 1. Ambil data asli pengguna sebagai konteks patokan simulasi (Read-Only)
    const [accountsRes, goalsRes, tasksRes, rulesRes] = await Promise.all([
        supabase.from('bank_accounts').select('name, balance').eq('user_id', user.id),
        supabase.from('goals').select('name, target_amount, current_amount').eq('user_id', user.id),
        supabase.from('tasks').select('title, status, due_date').eq('user_id', user.id).limit(10),
        supabase.from('ai_training_rules').select('*').eq('user_id', user.id).eq('is_active', true).order('created_at', { ascending: true })
    ]);

    const accounts = accountsRes.data || [];
    const goals = goalsRes.data || [];
    const tasks = tasksRes.data || [];
    const rules = rulesRes.data || [];

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

    // 3. Susun aturan kustom dinamis
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

    // 4. Riwayat chat dalam format teks
    const formattedHistory = history.map(h => `${h.sender === 'user' ? 'User' : 'Karen'}: ${h.text}`).join('\n');

    const systemPrompt = `
Namamu adalah "Karen". Kamu asisten pribadi yang jalan di WhatsApp.
Tugas utamamu: analisis pesan user, deteksi "Intent", ekstrak entitas penting, dan beri balasan — semua dalam satu JSON.
Mata uang default: IDR.

Daftar Intent Valid:
ADD_EXPENSE, ADD_INCOME, SET_BALANCE, SET_BUDGET, ADD_DEBT, ADD_RECEIVABLE, PAY_DEBT, DELETE_DEBT, DELETE_TRANSACTION, CREATE_GOAL, TOPUP_GOAL, DELETE_GOAL, QUERY_FINANCE, ADD_TASK, COMPLETE_TASK, UPDATE_TASK_PROGRESS, DELETE_TASK, ADD_SCHEDULE, DELETE_SCHEDULE, QUERY_AGENDA, ADD_REMINDER, RESCHEDULE_REMINDER, DELETE_REMINDER, UPDATE_LAST_TRANSACTION, CANCEL_LAST_TRANSACTION, QUERY_ROUTINE, UPDATE_ROUTINE, QUERY_THERAPY_SCHEDULE, SET_SEMESTER_START, QUERY_COURSE_SCHEDULE, ADD_COURSE_TARGET, COMPLETE_COURSE_WEEK, QUERY_COURSE_PROGRESS, CHITCHAT, UNKNOWN.

KONTEKS DATA PENGGUNA SAAT INI:
- Rekening: ${accountsContext}
- Target Tabungan: ${goalsContext}
- Tugas Aktif: ${tasksContext}

${customRulesSection}

ATURAN BALASAN (reply):
- Singkat banget, 1-2 kalimat max. Langsung ke intinya, santai/casual.
- DILARANG PAKAI EMOJI SAMA SEKALI (0 EMOJI).
- Jangan sebut namamu "Karen".
- Jika pesan menanyakan data (QUERY_*), jawab secara singkat berdasarkan konteks data di atas.

OUTPUT FORMAT: JSON murni TANPA markdown backticks:
{
  "intents": [
    {
      "intent": "NAMA_INTENT",
      "entities": {
        "amount": number | null,
        "category": string | null,
        "account": string | null,
        "person_name": string | null,
        "goal_name": string | null,
        "description": string | null,
        "task_name": string | null,
        "due_date": string | null
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

    // 5. Panggil Gemini AI
    const rawOutput = await callGeminiWithRotation(async (ai) => {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
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
    const reply = parsed.reply || '';

    // 6. Hitung Dampak Simulasi (Dry-Run) tanpa mengubah DB asli
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
        } else if (intent === 'ADD_TASK') {
            simulatedImpacts.push({
                type: 'Tugas Baru (To Do)',
                description: `Menambahkan tugas '${ent.task_name || ent.description || 'Tugas Baru'}' ke kolom To Do Kanban`,
                details: ent.due_date ? `Tenggat waktu: ${new Date(ent.due_date).toLocaleString('id-ID')}` : 'Tanpa tenggat waktu khusus'
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
                details: `Saldo kas/rekening berkurang Rp ${(Number(ent.amount) || 0).toLocaleString('id-ID')} dan piutang bertambah`
            });
        } else if (intent === 'PAY_DEBT') {
            simulatedImpacts.push({
                type: 'Pelunasan Hutang/Piutang',
                description: `Pelunasan dari/ke '${ent.person_name || 'Orang'}' sebesar Rp ${(Number(ent.amount) || 0).toLocaleString('id-ID')}`,
                details: ent.account ? `Saldo rekening ${ent.account} bertambah/disesuaikan` : 'Status hutang diupdate'
            });
        } else if (intent === 'TOPUP_GOAL') {
            simulatedImpacts.push({
                type: 'Setor Tabungan (Goal)',
                description: `Menambah tabungan target '${ent.goal_name || 'Goal'}' sebesar Rp ${(Number(ent.amount) || 0).toLocaleString('id-ID')}`,
                details: 'Progress bar tabungan di PWA bertambah secara virtual'
            });
        } else if (intent === 'QUERY_FINANCE') {
            simulatedImpacts.push({
                type: 'Pemeriksaan Keuangan',
                description: 'Membaca saldo rekening & alokasi tabungan tanpa mengubah data apapun'
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
