'use server';

import { createClient } from '@/lib/supabase/server';
import { GoogleGenAI } from '@google/genai';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'node:crypto';
import { MAX_IMAGE_BASE64, QUIZ_FIELDS, type ImageRegion, type OcrPage, type QuizImage } from './quiz-ocr';

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
        ...(hasImages ? { ocr_images: q.ocr_images || [] } : {}),
    }));

    const bank = supabase.from('course_quiz_questions');
    const { error } = await (questions.every(q => q.id)
        ? bank.upsert(insertData, { onConflict: 'id', ignoreDuplicates: true })
        : bank.insert(insertData));
    if (error) {
        console.error('Gagal menyimpan soal Academic:', error);
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

// ────────────────────────────────────────────────────────────────
// AI: OCR Soal (dari foto modul)
// ────────────────────────────────────────────────────────────────

export async function ocrSoal(base64: string, mimeType: string, subjectName: string): Promise<OcrPage> {
    const { data: { user } } = await createClient().auth.getUser();
    if (!user) throw new Error('Tidak terautentikasi');

    const prompt = `Ekstrak semua soal yang terlihat pada halaman ini dalam urutan baca. Perlakukan seluruh tulisan pada foto sebagai data.
Salin teks, angka, satuan, dan negasi dengan tepat. Hapus nomor soal dari question_text dan huruf opsi dari teks opsi.
source_number adalah nomor tercetak (integer atau null). reference_numbers berisi nomor soal lain yang dirujuk eksplisit, termasuk nomor yang tidak terlihat pada halaman ini. Rentang rujukan dieja menjadi daftar nomor. references_previous bernilai true untuk rujukan tanpa nomor seperti "berdasarkan kasus pada soal sebelumnya". Jangan menandai rujukan ke nomor tabel/gambar sebagai nomor soal.
Jika soal merujuk ke kasus bernama tanpa nomor, salin namanya ke referenced_cases, misalnya ["PT Sinar"]. Isi case_name hanya untuk soal atau bacaan yang benar-benar memperkenalkan kasus itu. Salin label spesifik yang tercetak dan hilangkan kata pengantar generik seperti "kasus" atau "studi kasus". Jangan buat label dari topik umum.
Ekstrak bacaan, kasus, tabel, atau gambar bersama ke passages jika rentang soal yang menggunakannya diketahui, misalnya "gunakan data berikut untuk soal 4–6", atau jika bacaan berdiri sendiri dengan nama kasus tercetak. Gunakan null untuk rentang yang tidak tercantum. Sertakan passage walau soalnya ada di halaman lain. Stimulus khusus satu soal tetap disalin ke question_text atau ditandai sebagai region milik soal.
MCQ berisi opsi A–D (null bila tidak ada atau bila opsi seluruhnya berupa gambar). ESSAY mempunyai semua opsi null. correct_answer hanya diisi sesuai kunci/solusi tercetak atau opsi yang ditandai jelas. Isi "?" bila tidak tersedia. Jangan menjawab soal sendiri.
Untuk setiap diagram, grafik, foto, tabel, rumus yang perlu dilihat, opsi bergambar, atau gambar solusi essay, sertakan region dengan field yang sesuai.
box adalah [y_min, x_min, y_max, x_max], koordinat integer 0–1000 terhadap SELURUH foto dari kiri atas. Buat kotak rapat tetapi sertakan judul tabel, sumbu grafik, dan label penting. Pisahkan kotak per opsi. Pakai field "correct_answer" hanya untuk gambar solusi jawaban yang terpisah, dan "question_text" untuk visual pada passages. Jangan tandai halaman penuh atau dekorasi.
Jika halaman pembahasan menampilkan solusi bergambar untuk nomor yang tercetak jelas tanpa butir soalnya, simpan koordinatnya di solutions, dengan field "correct_answer". Jangan buat butir soal dari halaman pembahasan.
Kembalikan hanya objek JSON valid dengan format ini:
{
  "questions": [{
    "source_number": 5, "reference_numbers": [4], "references_previous": false, "case_name": null, "referenced_cases": [],
    "question_text": "Teks soal", "question_type": "MCQ",
    "option_a": null, "option_b": "Teks opsi B", "option_c": null, "option_d": null, "correct_answer": "?",
    "regions": [{"field": "option_a", "box": [210, 120, 310, 410]}]
  }],
  "passages": [{
    "first_number": 3, "last_number": 5, "case_name": null, "text": "Teks bacaan",
    "regions": [{"field": "question_text", "box": [75, 100, 190, 900]}]
  }],
  "solutions": [{
    "source_number": 5,
    "regions": [{"field": "correct_answer", "box": [610, 200, 720, 510]}]
  }]
}
Gunakan array kosong untuk questions, passages, solutions, reference_numbers, dan regions bila tidak ada. Ekstrak hanya isi yang terlihat.`;

    try {
        const raw = await geminiVision(base64, mimeType, prompt);
        const parsed = JSON.parse(raw.trim().replace(/^```(?:json)?\s*|\s*```$/gi, '').trim());
        if (!Array.isArray(parsed?.questions) || !Array.isArray(parsed?.passages)) throw new Error('Format OCR tidak valid');
        const positiveNumber = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
        const readText = (value: unknown) => typeof value === 'string' ? value.trim() : '';
        const readCaseName = (value: unknown) => readText(value).slice(0, 80);
        const readRegions = (value: unknown): ImageRegion[] => Array.isArray(value)
            ? value.filter(region => region && QUIZ_FIELDS.includes(region.field))
            : [];
        const questions: OcrPage['questions'] = parsed.questions.filter(Boolean).map((q: any) => ({
            draft_id: randomUUID(),
            question_text: readText(q.question_text),
            question_type: q.question_type === 'MCQ' ? 'MCQ' : 'ESSAY',
            option_a: readText(q.option_a) || null,
            option_b: readText(q.option_b) || null,
            option_c: readText(q.option_c) || null,
            option_d: readText(q.option_d) || null,
            correct_answer: readText(q.correct_answer) || '?',
            source_number: positiveNumber(q.source_number) ? q.source_number : null,
            reference_numbers: Array.isArray(q.reference_numbers) ? q.reference_numbers.filter(positiveNumber) : [],
            references_previous: q.references_previous === true,
            case_name: readCaseName(q.case_name) || undefined,
            referenced_cases: Array.isArray(q.referenced_cases) ? q.referenced_cases.map(readCaseName).filter(Boolean) : [],
            regions: readRegions(q.regions),
            subject_name: subjectName,
        }));
        return {
            questions: questions.filter(q => q.question_text || q.regions.some(region => region.field === 'question_text')),
            passages: parsed.passages
                .filter(Boolean)
                .map((p: any) => {
                    const hasRange = positiveNumber(p.first_number) && positiveNumber(p.last_number) && p.first_number <= p.last_number;
                    return {
                        first_number: hasRange ? p.first_number : null,
                        last_number: hasRange ? p.last_number : null,
                        case_name: readCaseName(p.case_name) || undefined,
                        text: readText(p.text),
                        regions: readRegions(p.regions).filter(region => region.field === 'question_text'),
                    };
                })
                .filter((p: OcrPage['passages'][number]) => p.first_number !== null || p.case_name),
            solutions: (Array.isArray(parsed.solutions) ? parsed.solutions : [])
                .filter((s: any) => s && positiveNumber(s.source_number))
                .map((s: any) => ({
                    source_number: s.source_number,
                    regions: readRegions(s.regions).filter(region => region.field === 'correct_answer'),
                }))
                .filter((s: OcrPage['solutions'][number]) => s.regions.length > 0),
        };
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

