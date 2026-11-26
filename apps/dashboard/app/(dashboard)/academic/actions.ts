'use server';

import { createClient } from '@/lib/supabase/server';
import { GoogleGenAI } from '@google/genai';
import { revalidatePath } from 'next/cache';
import { MAX_IMAGE_BASE64, QUIZ_FIELDS, sortQuestionsBySourceNumber, type QuizImage } from './quiz-ocr';
import { EVENT_QUESTION_BATCH_SIZE, EVENT_RANDOM_COUNT, shuffleQuizItems, type EventQuestionSelection, type QuizBankQuestion } from './quiz-bank';

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

    const subject_name = (formData.get('subject_name') as string)?.trim();
    const module_title = (formData.get('module_title') as string)?.trim();
    const kb_title = (formData.get('kb_title') as string)?.trim();

    if (!subject_name) throw new Error('Nama mata kuliah wajib diisi');
    if (!module_title) throw new Error('Judul modul wajib diisi');
    if (!kb_title) throw new Error('Judul KB wajib diisi');

    const { data, error } = await supabase.from('course_modules').insert({
        user_id: user.id,
        subject_name,
        module_title,
        kb_title,
    }).select('id').single();

    if (error) throw error;
    revalidatePath('/academic');
    revalidatePath('/academic/schedule');
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

    const { data: module, error: moduleError } = await supabase.from('course_modules')
        .select('id').eq('id', moduleId).eq('user_id', user.id).single();
    if (moduleError || !module) return { error: 'Modul tidak ditemukan.' };

    for (const question of questions) {
        const images = question.ocr_images;
        if (images === undefined) continue;
        if (!Array.isArray(images) || images.some((image: QuizImage) => !image
            || !QUIZ_FIELDS.includes(image.field)
            || (image.label !== undefined && (typeof image.label !== 'string' || image.label.length > 120))
            || typeof image.data !== 'string'
            || image.data.length > MAX_IMAGE_BASE64
            || !/^UklGR[A-Za-z0-9+/]*={0,2}$/.test(image.data)
            || Buffer.from(image.data, 'base64').subarray(8, 12).toString() !== 'WEBP')) {
            return { error: 'Gagal menyimpan karena format gambar soal tidak valid.' };
        }
    }

    const hasImages = questions.some(q => q.ocr_images?.length);
    const insertData = questions.map(q => ({
        ...(q.id ? { id: q.id } : {}),
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
        ...(Number.isSafeInteger(q.source_number) && q.source_number > 0 ? { source_number: q.source_number } : {}),
        ...(hasImages ? { ocr_images: q.ocr_images || [] } : {}),
    }));

    const bank = supabase.from('course_quiz_questions');
    const { error } = await (questions.every(q => q.id)
        ? bank.upsert(insertData, { onConflict: 'id', ignoreDuplicates: true })
        : bank.insert(insertData));
    if (error) {
        console.error('Gagal menyimpan soal Academic:', error);
        if (questions.some(q => q.source_number != null) && (error.code === 'PGRST204' || error.code === '42703')) {
            return { error: 'Jalankan migrasi add_source_number_to_quiz_questions.sql di Supabase, lalu simpan ulang pratinjau ini.' };
        }
        if (hasImages && (error.code === 'PGRST204' || error.code === '42703')) {
            return { error: 'Gagal menyimpan gambar. Jalankan migrasi OCR Academic di Supabase terlebih dahulu.' };
        }
        return { error: 'Gagal menyimpan soal. Coba lagi.' };
    }
    revalidatePath(`/academic/${moduleId}`);
    return { success: true };
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

export async function applyKunciToModule(moduleId: string, kunci: Record<number, string>) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Tidak terautentikasi');

    // Nomor tercetak dipakai untuk soal OCR; data lama tetap memakai urutan simpan.
    const { data: questions, error: readError } = await supabase
        .from('course_quiz_questions')
        .select('*')
        .eq('module_id', moduleId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

    if (readError || !questions) return { error: 'Gagal membaca soal. Coba lagi.' };

    const orderedQuestions = sortQuestionsBySourceNumber(questions);

    // Hindari memasangkan kunci ke nomor yang ambigu.
    for (const [nomor, jawaban] of Object.entries(kunci)) {
        const matches = orderedQuestions.filter((q, index) => (q.source_number ?? index + 1) === Number(nomor));
        if (matches.length === 1) {
            const { error } = await supabase.from('course_quiz_questions')
                .update({ correct_answer: jawaban as string })
                .eq('id', matches[0].id).eq('user_id', user.id);
            if (error) return { error: 'Sebagian kunci gagal disimpan. Coba lagi.' };
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
    if (!q || q.ocr_images?.length) return null;

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

    if (!q || q.question_type !== 'ESSAY' || q.ocr_images?.length) return false;

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

    const { data, error } = await supabase
        .from('course_quiz_questions')
        .update({ user_note: userNote.trim() })
        .eq('id', questionId)
        .eq('user_id', user.id)
        .select('id')
        .maybeSingle();

    if (error) {
        console.error('Gagal menyimpan user_note:', error);
        throw error;
    }
    if (!data) throw new Error('Soal tidak tersedia.');
    return { success: true };
}

// ────────────────────────────────────────────────────────────────
// AI: Batch Paraphrase Soal On-The-Fly (Mode Challenge)
// ────────────────────────────────────────────────────────────────

const OPTION_KEYS = ['A', 'B', 'C', 'D'] as const;
const normText = (s: any) => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

async function paraphraseChunk(chunk: any[]): Promise<any[] | null> {
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
Tugasmu: Parafrase SEMUA butir soal pilihan ganda di bawah ini untuk Mode Ujian Challenge.
Tujuannya menguji pemahaman konsep, BUKAN hafalan kalimat.

Instruksi Wajib:
1. Tulis ulang 'question_text' dengan struktur kalimat, sudut pandang, atau skenario BARU. DILARANG menyalin kalimat asli; kalimat hasil tidak boleh sama atau hanya beda satu-dua kata dengan aslinya. Konsep yang ditanyakan harus PERSIS SAMA.
2. Tulis ulang 'option_a' sampai 'option_d' dengan kata-kata berbeda tetapi makna tetap sama. Jangan mengubah fakta, angka, atau satuan.
3. Pilihan yang benar HARUS tetap di huruf yang sama dengan 'correct_answer' aslinya.
   Pertahankan semua fakta, angka, serta konteks kasus atau rujukan yang sudah disalin ke teks soal.
4. Kembalikan HANYA array JSON valid (tanpa markdown backtick) berisi SEMUA soal:
[
  { "index": 0, "question_text": "...", "option_a": "...", "option_b": "...", "option_c": "...", "option_d": "...", "correct_answer": "..." }
]

Daftar Soal Sumber:
${JSON.stringify(promptInput, null, 2)}`;

    try {
        const raw = await geminiText(prompt);
        const parsed = JSON.parse(cleanJson(raw));
        return Array.isArray(parsed) ? parsed : null;
    } catch (err) {
        console.error('Error saat paraphrase chunk:', err);
        return null;
    }
}

function isValidParaphrase(original: any, p: any): boolean {
    if (!p || !p.question_text) return false;
    if (normText(p.question_text) === normText(original.question_text)) return false;
    for (const k of OPTION_KEYS) {
        const key = `option_${k.toLowerCase()}`;
        if (original[key] && !String(p[key] ?? '').trim()) return false;
    }
    return true;
}

// Acak posisi opsi dan petakan ulang kunci jawaban.
function shuffleOptions(q: any): any {
    const letters = OPTION_KEYS.filter((k) => q[`option_${k.toLowerCase()}`]);
    const correct = String(q.correct_answer ?? '').toUpperCase();
    if (letters.length < 2 || !(letters as readonly string[]).includes(correct)) return q;

    const items = letters.map((k) => ({ k: k as string, text: q[`option_${k.toLowerCase()}`] }));
    const shuffled = [...items].sort(() => Math.random() - 0.5);
    const result: any = { ...q };
    letters.forEach((slot, i) => {
        result[`option_${slot.toLowerCase()}`] = shuffled[i].text;
        if (shuffled[i].k === correct) result.correct_answer = slot;
    });
    return result;
}

export async function batchParaphraseQuestions(
    questions: any[]
): Promise<{ questions: any[]; failedCount: number }> {
    if (!questions || questions.length === 0) return { questions: [], failedCount: 0 };

    const chunkSize = 10;
    const results: any[] = [];
    let failedCount = 0;

    for (let i = 0; i < questions.length; i += chunkSize) {
        const chunk = questions.slice(i, i + chunkSize);
        let pending = chunk.map((_, j) => j);
        const done: Record<number, any> = {};

        // Maksimal 2 percobaan; percobaan kedua hanya untuk soal yang gagal validasi
        for (let attempt = 0; attempt < 2 && pending.length > 0; attempt++) {
            const subset = pending.map((j) => chunk[j]);
            const parsed = await paraphraseChunk(subset);
            if (!parsed) continue;

            const stillPending: number[] = [];
            pending.forEach((origIdx, subIdx) => {
                const original = chunk[origIdx];
                const pQ = parsed.find((p: any) => p?.index === subIdx) || parsed[subIdx];
                if (isValidParaphrase(original, pQ)) {
                    done[origIdx] = shuffleOptions({
                        ...original,
                        question_text: pQ.question_text,
                        option_a: pQ.option_a || original.option_a,
                        option_b: pQ.option_b || original.option_b,
                        option_c: pQ.option_c || original.option_c,
                        option_d: pQ.option_d || original.option_d,
                        correct_answer: original.correct_answer,
                        is_paraphrased: true,
                    });
                } else {
                    stillPending.push(origIdx);
                }
            });
            pending = stillPending;
        }

        chunk.forEach((original, j) => {
            if (done[j]) {
                results.push(done[j]);
            } else {
                failedCount++;
                results.push({ ...original, is_paraphrased: false });
            }
        });
    }

    return { questions: results, failedCount };
}


// ────────────────────────────────────────────────────────────────
// Mode Event: tentukan soal ujian, lalu muat isinya per kelompok
// ────────────────────────────────────────────────────────────────

export async function getEventQuestionIds(moduleIds: string[], selection: EventQuestionSelection): Promise<string[]> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Tidak terautentikasi');

    if (!moduleIds || moduleIds.length === 0) return [];

    const ids: string[] = [];
    let lastId: string | undefined;
    while (true) {
        let query = supabase.from('course_quiz_questions')
            .select('id').eq('user_id', user.id).in('module_id', moduleIds)
            .order('id').limit(500);
        if (selection !== 'all') query = query.eq('question_type', 'MCQ');
        if (lastId) query = query.gt('id', lastId);

        const { data, error } = await query;
        if (error) throw error;
        if (!data?.length) break;
        ids.push(...data.map(question => question.id));
        lastId = data[data.length - 1].id;
    }
    return selection === 'all' ? ids : shuffleQuizItems(ids).slice(0, EVENT_RANDOM_COUNT);
}

export async function getEventQuestionBatch(ids: string[]): Promise<{ questions: QuizBankQuestion[]; consumed: number }> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Tidak terautentikasi');
    if (ids.length === 0 || ids.length > EVENT_QUESTION_BATCH_SIZE) throw new Error('Ukuran kelompok soal tidak valid.');

    const { data, error } = await supabase.from('course_quiz_questions')
        .select('*').eq('user_id', user.id).in('id', ids);
    if (error) throw error;

    // Foto OCR tersimpan bersama soal. Batasi data tiap respons, bukan total soal ujian.
    const byId = new Map<string, QuizBankQuestion>((data ?? []).map(question => [question.id, question]));
    const questions: QuizBankQuestion[] = [];
    let bytes = 0;
    let consumed = 0;
    for (const id of ids) {
        const question = byId.get(id);
        if (question) {
            const size = Buffer.byteLength(JSON.stringify(question)) + 1;
            if (bytes + size > 3_800_000) {
                if (consumed === 0) throw new Error('Data satu soal terlalu besar untuk dimuat.');
                break;
            }
            questions.push(question);
            bytes += size;
        }
        consumed++;
    }
    return { questions, consumed };
}

