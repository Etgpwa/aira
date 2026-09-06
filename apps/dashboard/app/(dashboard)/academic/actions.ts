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
            model: 'gemini-3.5-flash',
            contents: prompt,
        });
        return response.text ?? '';
    });
}

async function geminiVision(base64: string, mimeType: string, prompt: string): Promise<string> {
    return callGeminiWithRotation(async (ai) => {
        const response = await ai.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: [
                { inlineData: { mimeType: mimeType || 'image/jpeg', data: base64 } },
                prompt
            ],
        });
        return response.text ?? '';
    });
}

function cleanJson(raw: string): string {
    if (!raw) return '';
    let cleaned = raw.replace(/```json/gi, '').replace(/```/gi, '').trim();
    // Prioritaskan mencari kurung siku [ ... ] untuk array
    const firstBracket = cleaned.indexOf('[');
    const lastBracket = cleaned.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
        return cleaned.substring(firstBracket, lastBracket + 1);
    }
    // Jika bukan array, cari kurung kurawal { ... } untuk object
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        return cleaned.substring(firstBrace, lastBrace + 1);
    }
    return cleaned;
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

export async function updateModule(moduleId: string, data: { subject_name: string; module_title: string; kb_title: string }) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Tidak terautentikasi');

    const { error } = await supabase.from('course_modules')
        .update({
            subject_name: data.subject_name.trim(),
            module_title: data.module_title.trim(),
            kb_title: data.kb_title.trim()
        })
        .eq('id', moduleId)
        .eq('user_id', user.id);

    if (error) throw error;
    revalidatePath('/academic');
    revalidatePath(`/academic/${moduleId}`);
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
    const prompt = `Kamu adalah sistem OCR cerdas pengekstraksi soal ujian dan tugas kuliah.
Gambar ini bisa berupa foto modul/buku teks, screenshot dokumen digital/PDF, tangkapan layar HP/laptop, atau lembar tugas kuliah yang berisi soal-soal latihan/ujian.
Tugasmu: Ekstrak SEMUA soal yang ditemukan di gambar ini secara akurat.
Dukung baik soal pilihan ganda (MCQ) maupun soal essay/uraian.
Untuk setiap soal, identifikasi:
- question_text: Teks pertanyaan lengkap (hilangkan nomor soal di awal seperti '1. ', '2. ', dsb).
- question_type: "MCQ" jika ada opsi pilihan ganda, atau "ESSAY" jika berupa uraian.
- option_a, option_b, option_c, option_d: Teks opsi jika MCQ (hilangkan prefix seperti 'a. ', 'b. ', dsb). Jika soal essay atau opsi kurang dari 4, opsi yang tidak ada diisi null.
- correct_answer: Jika ada tanda kunci jawaban di gambar (misal dilingkari, dicentang, atau di-bold), tulis huruf jawabannya ("A", "B", "C", atau "D"). Jika tidak diketahui, isi "?".

Kembalikan HANYA array JSON valid tanpa markdown backticks dan tanpa teks pengantar apapun:
[
  {
    "question_text": "teks pertanyaan lengkap",
    "question_type": "MCQ",
    "option_a": "teks opsi A",
    "option_b": "teks opsi B",
    "option_c": "teks opsi C",
    "option_d": "teks opsi D",
    "correct_answer": "?"
  }
]

Jika tidak ada soal yang terdeteksi di gambar, kembalikan array kosong: []`;

    try {
        const raw = await geminiVision(base64, mimeType, prompt);
        const cleaned = cleanJson(raw);
        const parsed = JSON.parse(cleaned);
        if (!Array.isArray(parsed)) return [];
        return parsed.map(q => ({ ...q, subject_name: subjectName }));
    } catch (err) {
        console.error('❌ Gagal memproses OCR Soal:', err);
        throw new Error('Gagal mengekstrak soal dari gambar. Pastikan gambar cukup jelas dan coba lagi.');
    }
}

// ────────────────────────────────────────────────────────────────
// AI: OCR Kunci Jawaban (dari foto lembar jawaban)
// ────────────────────────────────────────────────────────────────

export async function ocrKunciJawaban(base64: string, mimeType: string): Promise<Record<number, string>> {
    const prompt = `Gambar ini adalah lembar kunci jawaban soal ujian/latihan (bisa foto cetak atau screenshot digital).
Ekstrak semua pasangan nomor soal dan huruf jawaban yang benar.
Kembalikan HANYA JSON object valid ini (tanpa markdown backtick):
{
  "1": "A",
  "2": "C",
  "3": "B"
}
Gunakan string nomor ("1", "2", dst) sebagai key dan huruf kapital ("A", "B", "C", "D", "E") sebagai value. Jika tidak ada yang terbaca jelas, kembalikan: {}`;

    try {
        const raw = await geminiVision(base64, mimeType, prompt);
        const cleaned = cleanJson(raw);
        const parsed = JSON.parse(cleaned);
        return parsed || {};
    } catch (err) {
        console.error('❌ Gagal memproses OCR Kunci:', err);
        throw new Error('Gagal mengekstrak kunci jawaban dari gambar.');
    }
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

// ────────────────────────────────────────────────────────────────
// User Notes: Simpan Catatan / Trik Pengerjaan Pembahasan
// ────────────────────────────────────────────────────────────────

export async function saveQuestionNote(questionId: string, userNote: string) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Tidak terautentikasi');

    const { error } = await supabase
        .from('course_quiz_questions')
        .update({ user_note: userNote.trim() })
        .eq('id', questionId)
        .eq('user_id', user.id);

    if (error) {
        console.error('Gagal menyimpan user_note:', error);
        throw error;
    }
    return { success: true };
}

// ────────────────────────────────────────────────────────────────
// AI: Batch Paraphrase Soal On-The-Fly (Mode Challenge)
// ────────────────────────────────────────────────────────────────

export async function batchParaphraseQuestions(questions: any[]): Promise<any[]> {
    if (!questions || questions.length === 0) return [];

    const chunkSize = 10;
    const allParaphrased: any[] = [];

    for (let i = 0; i < questions.length; i += chunkSize) {
        const chunk = questions.slice(i, i + chunkSize);
        const promptInput = chunk.map((q, idx) => ({
            index: idx,
            question_text: q.question_text,
            option_a: q.option_a,
            option_b: q.option_b,
            option_c: q.option_c,
            option_d: q.option_d,
            correct_answer: q.correct_answer,
        }));

        const prompt = `Kamu adalah dosen dan pembuat soal ujian akademik universitas.
Tugasmu: Parafrase SEMUA butir soal pilihan ganda di bawah ini secara serentak untuk Mode Ujian Challenge.
Tujuannya adalah menguji pemahaman konsep siswa, BUKAN sekadar hafalan kalimat.

Instruksi Wajib:
1. Tulis ulang 'question_text' dengan sudut pandang, skenario, atau kalimat baru yang segar tetapi menanyakan konsep ilmiah/materi yang PERSIS SAMA.
2. Variasikan kalimat pada 'option_a', 'option_b', 'option_c', dan 'option_d'.
3. SANGAT KRUSIAL: Pilihan jawaban yang benar HARUS TETAP BERADA di huruf yang sama dengan 'correct_answer' aslinya, sehingga kunci jawaban tidak berubah!
4. Kembalikan HANYA array JSON valid (tanpa markdown backtick):
[
  {
    "index": 0,
    "question_text": "...",
    "option_a": "...",
    "option_b": "...",
    "option_c": "...",
    "option_d": "...",
    "correct_answer": "..."
  }
]

Daftar Soal Sumber:
${JSON.stringify(promptInput, null, 2)}`;

        try {
            const raw = await geminiText(prompt);
            const cleaned = cleanJson(raw);
            const parsed = JSON.parse(cleaned);

            if (Array.isArray(parsed)) {
                for (let j = 0; j < chunk.length; j++) {
                    const originalQ = chunk[j];
                    const pQ = parsed.find((p: any) => p.index === j) || parsed[j];
                    if (pQ && pQ.question_text) {
                        allParaphrased.push({
                            ...originalQ,
                            question_text: pQ.question_text,
                            option_a: pQ.option_a || originalQ.option_a,
                            option_b: pQ.option_b || originalQ.option_b,
                            option_c: pQ.option_c || originalQ.option_c,
                            option_d: pQ.option_d || originalQ.option_d,
                            correct_answer: originalQ.correct_answer,
                            is_paraphrased: true,
                        });
                    } else {
                        allParaphrased.push({ ...originalQ, is_paraphrased: false });
                    }
                }
            } else {
                allParaphrased.push(...chunk);
            }
        } catch (err) {
            console.error('Error saat batch paraphrase chunk:', err);
            allParaphrased.push(...chunk);
        }
    }

    return allParaphrased;
}

// ────────────────────────────────────────────────────────────────
// Mode Event: Ambil 30 Soal Acak dari Multiple KB
// ────────────────────────────────────────────────────────────────

export async function getEventQuestions(moduleIds: string[]): Promise<any[]> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Tidak terautentikasi');

    if (!moduleIds || moduleIds.length === 0) return [];

    const { data: questions, error } = await supabase
        .from('course_quiz_questions')
        .select('*')
        .in('module_id', moduleIds)
        .eq('user_id', user.id)
        .eq('question_type', 'MCQ');

    if (error) {
        console.error('Gagal mengambil event questions:', error);
        throw error;
    }

    if (!questions || questions.length === 0) return [];

    const shuffled = [...questions].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 30);
}

