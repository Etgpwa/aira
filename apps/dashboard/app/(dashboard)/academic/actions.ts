'use server';

import { createClient } from '@/lib/supabase/server';
import { GoogleGenAI } from '@google/genai';
import { revalidatePath } from 'next/cache';

// ────────────────────────────────────────────────────────────────
// Helper: Rotasi Multi-API Key Gemini untuk PWA (Anti-Limit 429/503)
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
        console.warn(`🔄 PWA Gemini: Beralih ke API Key index [${this.currentIndex + 1}/${this.keys.length}]`);
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
        if (!key) throw new Error('GEMINI_API_KEY / GEMINI_API_KEYS belum dikonfigurasi di .env.local dashboard');

        try {
            const ai = new GoogleGenAI({ apiKey: key });
            return await task(ai);
        } catch (error: any) {
            const isRateLimitOrOverload = error?.status === 429 || error?.status === 503 || error?.status === 500 || 
                String(error).includes('429') || String(error).includes('503') || String(error).includes('500') ||
                String(error).includes('exceeded your') || String(error).includes('overloaded') || String(error).includes('UNAVAILABLE');

            if (isRateLimitOrOverload && pwaApiKeyManager.totalKeys > 1) {
                console.warn(`⚠️ PWA Gemini Rate Limit / Overload (429/503). Meniup key ini dan mencoba key berikutnya...`);
                pwaApiKeyManager.rotateToNextKey();
                maxAttempts--;
            } else {
                console.error('❌ PWA Gemini API Error:', error);
                throw error;
            }
        }
    }
    throw new Error('Gagal memproses request Gemini setelah beberapa kali percobaan rotasi key.');
}

async function geminiText(prompt: string): Promise<string> {
    return callGeminiWithRotation(async (ai) => {
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: prompt,
        });
        return response.text ?? '';
    });
}

async function geminiVision(base64: string, mimeType: string, prompt: string): Promise<string> {
    return callGeminiWithRotation(async (ai) => {
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: [
                { inlineData: { mimeType: mimeType || 'image/jpeg', data: base64 } },
                prompt
            ],
        });
        return response.text ?? '';
    });
}

function cleanJson(raw: string): string {
    return raw.replace(/```json/gi, '').replace(/```/gi, '').trim();
}

// ────────────────────────────────────────────────────────────────
// CRUD: Course Modules
// ────────────────────────────────────────────────────────────────

export async function createModule(formData: FormData) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Tidak terautentikasi');

    const subject_name = formData.get('subject_name') as string;
    const module_title = formData.get('module_title') as string;
    const kb_title = formData.get('kb_title') as string;

    const { data, error } = await supabase.from('course_modules').insert({
        user_id: user.id,
        subject_name,
        module_title,
        kb_title,
    }).select('id').single();

    if (error) throw error;
    revalidatePath('/academic');
    return { id: data.id };
}

export async function deleteModule(moduleId: string) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Tidak terautentikasi');

    await supabase.from('course_modules').delete().eq('id', moduleId).eq('user_id', user.id);
    revalidatePath('/academic');
}

export async function completeModule(moduleId: string, score: number) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Tidak terautentikasi');

    // Simpan best_score (hanya update jika skor baru lebih tinggi)
    const { data: existing } = await supabase
        .from('course_modules')
        .select('best_score')
        .eq('id', moduleId)
        .single();

    const newBestScore = Math.max(score, existing?.best_score ?? 0);

    await supabase.from('course_modules').update({
        is_completed: true,
        completed_at: new Date().toISOString(),
        best_score: newBestScore,
    }).eq('id', moduleId).eq('user_id', user.id);

    revalidatePath('/academic');
    revalidatePath(`/academic/${moduleId}`);
}

// ────────────────────────────────────────────────────────────────
// CRUD: Quiz Questions
// ────────────────────────────────────────────────────────────────

export async function saveQuestions(questions: any[], moduleId: string) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Tidak terautentikasi');

    const insertData = questions.map(q => ({
        user_id: user.id,
        module_id: moduleId,
        question_text: q.question_text,
        question_type: q.question_type || 'MCQ',
        option_a: q.option_a || null,
        option_b: q.option_b || null,
        option_c: q.option_c || null,
        option_d: q.option_d || null,
        correct_answer: q.correct_answer || '?',
        subject_name: q.subject_name || '',
        already_asked: false,
    }));

    const { error } = await supabase.from('course_quiz_questions').insert(insertData);
    if (error) throw error;
    revalidatePath(`/academic/${moduleId}`);
}

export async function updateQuestion(questionId: string, data: any) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Tidak terautentikasi');

    const { error } = await supabase.from('course_quiz_questions')
        .update({
            question_text: data.question_text,
            question_type: data.question_type,
            option_a: data.option_a || null,
            option_b: data.option_b || null,
            option_c: data.option_c || null,
            option_d: data.option_d || null,
            correct_answer: data.correct_answer,
        })
        .eq('id', questionId)
        .eq('user_id', user.id);

    if (error) throw error;
    revalidatePath('/academic');
}

export async function deleteQuestion(questionId: string, moduleId: string) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Tidak terautentikasi');

    await supabase.from('course_quiz_questions').delete().eq('id', questionId).eq('user_id', user.id);
    revalidatePath(`/academic/${moduleId}`);
}

// ────────────────────────────────────────────────────────────────
// AI: OCR Soal (dari foto modul)
// ────────────────────────────────────────────────────────────────

export async function ocrSoal(base64: string, mimeType: string, subjectName: string): Promise<any[]> {
    const prompt = `Kamu adalah sistem ekstraksi soal ujian. Gambar ini adalah halaman modul/buku teks kuliah yang berisi soal-soal latihan.
Ekstrak SEMUA soal yang ditemukan, termasuk soal pilihan ganda dan essay.
Untuk setiap soal, identifikasi: teks soal, tipe (MCQ atau ESSAY), dan pilihan A/B/C/D jika ada.
Jangan sertakan nomor soal di dalam question_text. correct_answer diisi "?" untuk sementara jika tidak ada kunci.

Kembalikan HANYA array JSON valid ini (tanpa markdown backtick, tanpa penjelasan):
[{
  "question_text": "teks pertanyaan lengkap",
  "question_type": "MCQ",
  "option_a": "teks opsi A",
  "option_b": "teks opsi B",
  "option_c": "teks opsi C",
  "option_d": "teks opsi D",
  "correct_answer": "?"
}]

Jika soal essay, option_a sampai option_d diisi null.
Jika tidak ada soal, kembalikan: []`;

    const raw = await geminiVision(base64, mimeType, prompt);
    const parsed = JSON.parse(cleanJson(raw));
    if (!Array.isArray(parsed)) return [];
    return parsed.map(q => ({ ...q, subject_name: subjectName }));
}

// ────────────────────────────────────────────────────────────────
// AI: OCR Kunci Jawaban (dari foto lembar jawaban)
// ────────────────────────────────────────────────────────────────

export async function ocrKunciJawaban(base64: string, mimeType: string): Promise<Record<number, string>> {
    const prompt = `Gambar ini adalah lembar kunci jawaban soal ujian/latihan.
Ekstrak semua pasangan nomor soal dan jawaban yang benar.
Kembalikan HANYA JSON object ini (tanpa markdown backtick):
{
  "1": "A",
  "2": "C",
  "3": "B"
}
Gunakan integer sebagai key. Jika lembar jawaban tidak terbaca jelas, kembalikan: {}`;

    const raw = await geminiVision(base64, mimeType, prompt);
    const parsed = JSON.parse(cleanJson(raw));
    return parsed || {};
}

export async function applyKunciToModule(moduleId: string, kunci: Record<number, string>) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Tidak terautentikasi');

    // Ambil semua soal di modul ini, urut sesuai created_at
    const { data: questions } = await supabase
        .from('course_quiz_questions')
        .select('id')
        .eq('module_id', moduleId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

    if (!questions) return;

    // Patch jawaban berdasarkan nomor urut
    for (const [nomor, jawaban] of Object.entries(kunci)) {
        const idx = parseInt(nomor as string) - 1;
        if (idx >= 0 && idx < questions.length) {
            await supabase.from('course_quiz_questions')
                .update({ correct_answer: jawaban as string })
                .eq('id', questions[idx].id);
        }
    }

    revalidatePath(`/academic/${moduleId}`);
}

// ────────────────────────────────────────────────────────────────
// AI: Parafrase Soal
// ────────────────────────────────────────────────────────────────

export async function paraphraseQuestion(questionId: string, moduleId: string): Promise<any | null> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: q } = await supabase.from('course_quiz_questions').select('*').eq('id', questionId).single();
    if (!q) return null;

    const prompt = `Kamu adalah tutor akademik. Buat satu parafrase (versi kata-kata berbeda, makna SAMA PERSIS) dari soal berikut:
Soal: "${q.question_text}"
${q.option_a ? `A. ${q.option_a}\nB. ${q.option_b}\nC. ${q.option_c}\nD. ${q.option_d}\nJawaban: ${q.correct_answer}` : ''}

Kembalikan HANYA JSON ini (tanpa markdown backtick):
{
  "question_text": "teks soal yang diparafrase",
  "option_a": "opsi A (jika MCQ, gunakan pilihan yang SAMA tapi kata-katanya divariasi sedikit)",
  "option_b": "...",
  "option_c": "...",
  "option_d": "...",
  "correct_answer": "${q.correct_answer}"
}
Untuk essay, option_a sampai option_d diisi null.`;

    const raw = await geminiText(prompt);
    const parsed = JSON.parse(cleanJson(raw));

    // Simpan sebagai soal baru di modul yang sama
    const { data: newQ, error } = await supabase.from('course_quiz_questions').insert({
        user_id: user.id,
        module_id: moduleId,
        subject_name: q.subject_name,
        question_text: parsed.question_text,
        question_type: q.question_type,
        option_a: parsed.option_a || null,
        option_b: parsed.option_b || null,
        option_c: parsed.option_c || null,
        option_d: parsed.option_d || null,
        correct_answer: parsed.correct_answer || q.correct_answer,
        already_asked: false,
    }).select().single();

    if (error) throw error;
    revalidatePath(`/academic/${moduleId}`);
    return newQ;
}

// ────────────────────────────────────────────────────────────────
// AI: Generate Distractor (Essay → MCQ)
// ────────────────────────────────────────────────────────────────

export async function generateDistractors(questionId: string, moduleId: string): Promise<boolean> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data: q } = await supabase.from('course_quiz_questions')
        .select('*').eq('id', questionId).single();

    if (!q || q.question_type !== 'ESSAY') return false;

    const prompt = `Kamu adalah pembuat soal akademik. Soal essay berikut perlu diubah menjadi soal pilihan ganda (MCQ).
Soal: "${q.question_text}"
Jawaban benar: "${q.correct_answer}"

Buat 3 jawaban salah (distractor) yang masuk akal dan terkait topik, tapi SALAH secara faktual.
Urutkan semua opsi secara acak sehingga jawaban benar tidak selalu di "A".

Kembalikan HANYA JSON ini (tanpa markdown backtick):
{
  "option_a": "...",
  "option_b": "...",
  "option_c": "...",
  "option_d": "...",
  "correct_answer": "A atau B atau C atau D (pilih mana yang berisi jawaban benar)"
}`;

    const raw = await geminiText(prompt);
    const parsed = JSON.parse(cleanJson(raw));

    await supabase.from('course_quiz_questions').update({
        question_type: 'MCQ',
        option_a: parsed.option_a,
        option_b: parsed.option_b,
        option_c: parsed.option_c,
        option_d: parsed.option_d,
        correct_answer: parsed.correct_answer,
    }).eq('id', questionId);

    revalidatePath(`/academic/${moduleId}`);
    return true;
}
