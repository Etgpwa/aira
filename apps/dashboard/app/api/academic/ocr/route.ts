import { randomUUID } from 'node:crypto';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { MAX_OCR_PHOTO_BASE64, parseOcrAnswerKey, parseOcrPage } from '@/app/(dashboard)/academic/quiz-ocr';
import { QUIZ_OCR_PROMPTS } from '@/app/(dashboard)/academic/quiz-ocr-prompts';

export const maxDuration = 35;

const PRIMARY_MODEL = 'gemini-3.8-flash';
const FALLBACK_MODEL = 'gemini-3.6-flash';
const PRIMARY_TIMEOUT_MS = 14_000;
const RETRY_TIMEOUT_MS = 25_000;
let nextKeyIndex = 0;

function ocrError(error: string, status: number) {
    return NextResponse.json({ error }, { status });
}

export async function POST(request: Request) {
    const deadline = AbortSignal.any([request.signal, AbortSignal.timeout(30_000)]);
    const { data: { user }, error: authError } = await createClient().auth.getUser();
    if (!user) {
        if (authError && authError.status && authError.status >= 500) {
            return ocrError('Layanan login sedang tidak bisa dihubungi. Coba lagi.', 503);
        }
        return ocrError('Sesi login berakhir. Masuk kembali lalu ulangi scan.', 401);
    }

    let payload: Record<string, unknown> | null;
    try {
        payload = await request.json();
    } catch {
        return ocrError('Kiriman foto tidak lengkap. Pilih fotonya kembali.', 400);
    }

    const { kind, base64, mimeType, subjectName } = payload ?? {};
    if (kind !== 'questions' && kind !== 'answer_key') return ocrError('Jenis scan tidak dikenali.', 400);
    if (typeof base64 !== 'string' || !base64 || typeof mimeType !== 'string'
        || !/^image\/(jpeg|png|webp|heic|heif)$/.test(mimeType)) {
        return ocrError('Format foto tidak didukung. Gunakan JPG, PNG, WebP, HEIC, atau HEIF.', 400);
    }
    if (base64.length > MAX_OCR_PHOTO_BASE64) {
        return ocrError('File foto terlalu besar. Pilih versi berukuran lebih kecil.', 413);
    }

    const keys = (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '').split(',').map(key => key.trim()).filter(Boolean);
    if (!keys.length) return ocrError('API key Gemini belum dikonfigurasi di dashboard.', 503);
    const firstKey = nextKeyIndex % keys.length;
    nextKeyIndex = (firstKey + 1) % keys.length;

    let model = PRIMARY_MODEL;
    for (let attempt = 0; ; attempt++) {
        const timeout = attempt === 0 ? PRIMARY_TIMEOUT_MS : RETRY_TIMEOUT_MS;
        const signal = AbortSignal.any([deadline, AbortSignal.timeout(timeout)]);
        try {
            signal.throwIfAborted();
            const ai = new GoogleGenAI({ apiKey: keys[(firstKey + attempt) % keys.length] });
            const response = await ai.models.generateContent({
                model,
                contents: [{ inlineData: { mimeType, data: base64 } }, QUIZ_OCR_PROMPTS[kind]],
                config: {
                    responseMimeType: 'application/json',
                    thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
                    httpOptions: { timeout, retryOptions: { attempts: 1 } },
                    abortSignal: signal,
                },
            });
            const data = kind === 'questions'
                ? parseOcrPage(response.text ?? '', typeof subjectName === 'string' ? subjectName : '', randomUUID)
                : parseOcrAnswerKey(response.text ?? '');
            return NextResponse.json({ data });
        } catch (error) {
            const status = typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : 0;
            const timedOut = signal.aborted || status === 408 || status === 504
                || (error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name));
            const badResponse = error instanceof SyntaxError;
            const providerUnavailable = timedOut || status === 429 || status >= 500;
            const retryable = providerUnavailable || badResponse || !status
                || ([401, 403].includes(status) && keys.length > 1);
            console.warn('Academic OCR request failed', { model, attempt: attempt + 1, status, timedOut, badResponse });
            if (attempt === 0 && !deadline.aborted && retryable) {
                if (providerUnavailable) model = FALLBACK_MODEL;
                continue;
            }

            if (timedOut) return ocrError('Gemini terlalu lama merespons. Ulangi scan foto ini.', 504);
            if (badResponse) return ocrError('Respons OCR dari Gemini belum bisa dibaca. Ulangi scan foto ini.', 502);
            if (status === 429 || status === 503) return ocrError('Gemini sedang sibuk atau kuotanya habis. Coba lagi sebentar.', 503);
            if (status === 401 || status === 403 || status === 404) return ocrError('Gemini menolak akses OCR. Periksa API key dan akses model.', 502);
            if (status === 400) return ocrError('Gemini menolak permintaan OCR. Coba kirim foto sebagai JPG atau PNG.', 502);
            return ocrError('Koneksi ke Gemini gagal. Ulangi scan foto ini.', 502);
        }
    }
}
