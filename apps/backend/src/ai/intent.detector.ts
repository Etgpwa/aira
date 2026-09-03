import { askGemini } from './gemini.client';
import { INTENT_SYSTEM_PROMPT } from './prompts/intent.prompt';
import { memoryManager } from './memory.manager';
import { supabase } from '../supabase/supabase.client';

export interface SingleIntent {
    intent: 'ADD_EXPENSE' | 'ADD_INCOME' | 'SET_BALANCE' | 'SET_BUDGET' | 'ADD_DEBT' | 'ADD_RECEIVABLE' | 'PAY_DEBT' | 'DELETE_DEBT' | 'DELETE_TRANSACTION' | 'CREATE_GOAL' | 'TOPUP_GOAL' | 'DELETE_GOAL' | 'QUERY_FINANCE' | 'ADD_TASK' | 'COMPLETE_TASK' | 'UPDATE_TASK_PROGRESS' | 'DELETE_TASK' | 'ADD_SCHEDULE' | 'DELETE_SCHEDULE' | 'QUERY_AGENDA' | 'ADD_REMINDER' | 'RESCHEDULE_REMINDER' | 'DELETE_REMINDER' | 'UPDATE_LAST_TRANSACTION' | 'CANCEL_LAST_TRANSACTION' | 'QUERY_ROUTINE' | 'UPDATE_ROUTINE' | 'QUERY_THERAPY_SCHEDULE' | 'SET_SEMESTER_START' | 'QUERY_COURSE_SCHEDULE' | 'ADD_COURSE_TARGET' | 'COMPLETE_COURSE_WEEK' | 'QUERY_COURSE_PROGRESS' | 'CHITCHAT' | 'UNKNOWN';
    entities: {
        amount: number | null;
        currency: string | null;
        person_name: string | null;
        goal_name: string | null;
        category: string | null;
        account: string | null;
        description: string | null;
        task_name?: string | null;
        subject_name?: string | null;
        due_date?: string | null;
        day_of_week?: number | null;
        start_time?: string | null;
        end_time?: string | null;
        semester_start_date?: string | null;
        week_number?: number | null;
    };
}

export interface IntentResult {
    intents: SingleIntent[];
    reply: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Dynamic System Prompt: Injeksi Aturan Pelatihan / Few-Shot dari Supabase
// ─────────────────────────────────────────────────────────────────────────────
export async function getDynamicSystemPrompt(): Promise<string> {
    try {
        const { data: rules, error } = await supabase
            .from('ai_training_rules')
            .select('sample_phrase, expected_intents, explanation_rule')
            .eq('is_active', true)
            .order('created_at', { ascending: true });

        if (error || !rules || rules.length === 0) {
            return INTENT_SYSTEM_PROMPT;
        }

        let customSection = `\n\n=== ATURAN PELATIHAN KUSTOM DARI USER (PRIORITAS TINGGI) ===\n`;
        customSection += `Berikut adalah aturan dan contoh intent spesifik yang telah dipelajari dari koreksi user sebelumnya. Jika pesan user mirip atau mengikuti pola ini, WAJIB ikuti format intent dan ekstraksi ini:\n`;

        rules.forEach((r, idx) => {
            customSection += `${idx + 1}. Contoh Perintah: "${r.sample_phrase}"\n`;
            if (r.explanation_rule) {
                customSection += `   Aturan/Penjelasan: ${r.explanation_rule}\n`;
            }
            customSection += `   Expected Intents: ${JSON.stringify(r.expected_intents)}\n`;
        });
        customSection += `============================================================\n`;

        return INTENT_SYSTEM_PROMPT + customSection;
    } catch {
        return INTENT_SYSTEM_PROMPT;
    }
}

export const detectIntent = async (sessionId: string, text: string): Promise<IntentResult> => {
    try {
        // 1. Simpan pesan user ke memory
        memoryManager.addMessage(sessionId, 'user', text);

        // 2. Ambil riwayat chat pendek (maks 4 pesan)
        const chatHistory = memoryManager.getFormattedHistory(sessionId);
        const now = new Date();
        const currentTimeStr = `${now.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} (WIB), ISO: ${now.toISOString()}`;
        
        // 3. Susun prompt gabungan antara history, waktu saat ini, dan instruksi
        const finalPrompt = `
WAKTU REAL-TIME SAAT INI: ${currentTimeStr}

=== RIWAYAT CHAT (Konteks) ===
${chatHistory}
==============================

Analisis pesan terakhir dari User di atas dan berikan balasan dalam format JSON sesuai instruksi sistem.
Jika user menyebutkan waktu/tanggal relatif (misal "besok jam 10", "nanti malam jam 23:40", "lusa"), konversikan ke "due_date" format ISO 8601 dengan timezone offset WIB (+07:00) (misal: "2026-08-25T23:40:00+07:00") berdasarkan WAKTU REAL-TIME SAAT INI di atas.
`;

        const systemPrompt = await getDynamicSystemPrompt();
        const responseText = await askGemini(finalPrompt, systemPrompt);

        // Membersihkan jika output dari Gemini ada markdown block `json ... `
        const cleanJsonStr = responseText.replace(/```json/gi, '').replace(/```/gi, '').trim();

        const result: IntentResult = JSON.parse(cleanJsonStr);

        // 4. Simpan balasan Karen ke memory
        if (result.reply) {
            memoryManager.addMessage(sessionId, 'assistant', result.reply);
        }

        return result;
    } catch (error) {
        console.error("Error mendeteksi intent:", error);
        return {
            intents: [{
                intent: 'UNKNOWN',
                entities: { amount: null, currency: null, person_name: null, goal_name: null, category: null, account: null, description: null }
            }],
            reply: 'Waduh, aku sedikit error nih pas mikir. Bisa ulangi lagi?'
        };
    }
};
