import { askGemini } from './gemini.client';
import { INTENT_SYSTEM_PROMPT } from './prompts/intent.prompt';
import { memoryManager } from './memory.manager';

export interface IntentResult {
    intent: 'ADD_EXPENSE' | 'ADD_INCOME' | 'SET_BALANCE' | 'SET_BUDGET' | 'ADD_DEBT' | 'ADD_RECEIVABLE' | 'PAY_DEBT' | 'CREATE_GOAL' | 'TOPUP_GOAL' | 'DELETE_GOAL' | 'QUERY_FINANCE' | 'ADD_TASK' | 'COMPLETE_TASK' | 'DELETE_TASK' | 'ADD_SCHEDULE' | 'DELETE_SCHEDULE' | 'QUERY_AGENDA' | 'CHITCHAT' | 'UNKNOWN';
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
    };
    reply: string;
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

        const responseText = await askGemini(finalPrompt, INTENT_SYSTEM_PROMPT);

        // Membersihkan jika output dari Gemini ada markdown block `json ... `
        const cleanJsonStr = responseText.replace(/```json/gi, '').replace(/```/gi, '').trim();

        const result: IntentResult = JSON.parse(cleanJsonStr);

        // 4. Simpan balasan Aira ke memory
        if (result.reply) {
            memoryManager.addMessage(sessionId, 'assistant', result.reply);
        }

        return result;
    } catch (error) {
        console.error("Error mendeteksi intent:", error);
        return {
            intent: 'UNKNOWN',
            entities: { amount: null, currency: null, person_name: null, goal_name: null, category: null, account: null, description: null },
            reply: 'Waduh, aku sedikit error nih pas mikir. Bisa ulangi lagi?'
        };
    }
};
