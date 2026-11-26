import { randomUUID } from 'node:crypto';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { MAX_OCR_PHOTO_BASE64, parseOcrAnswerKey, parseOcrPage, readPersonalGeminiKeys, readTokenMurahOcrSettings } from '@/app/(dashboard)/academic/quiz-ocr';
import { QUIZ_OCR_PROMPTS } from '@/app/(dashboard)/academic/quiz-ocr-prompts';
import { getOcrGeminiKeys, OCR_GEMINI_TIMEOUT_MS, runOcrGeminiRotation } from './gemini-rotation';
import { requestTokenMurahOcr } from './tokenmurah';

export const maxDuration = 35;

let nextKeyIndex = 0;

function ocrError(error: string, status: number) {
    return NextResponse.json({ error }, { status });
}

export async function POST(request: Request) {
    const deadline = Date.now() + OCR_GEMINI_TIMEOUT_MS;
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

    const { kind, base64, mimeType, subjectName, personalGeminiKeys, tokenMurah } = payload ?? {};
    if (kind !== 'questions' && kind !== 'answer_key') return ocrError('Jenis scan tidak dikenali.', 400);
    if (typeof base64 !== 'string' || !base64 || typeof mimeType !== 'string'
        || !/^image\/(jpeg|png|webp|heic|heif)$/.test(mimeType)) {
        return ocrError('Format foto tidak didukung. Gunakan JPG, PNG, WebP, HEIC, atau HEIF.', 400);
    }
    if (base64.length > MAX_OCR_PHOTO_BASE64) {
        return ocrError('File foto terlalu besar. Pilih versi berukuran lebih kecil.', 413);
    }

    const parseResult = (text: string) => kind === 'questions'
        ? parseOcrPage(text, typeof subjectName === 'string' ? subjectName : '', randomUUID)
        : parseOcrAnswerKey(text);

    if (tokenMurah !== undefined) {
        const settings = readTokenMurahOcrSettings(tokenMurah);
        if (!settings) return ocrError('Format key atau ID model TokenMurah tidak valid.', 400);
        const remaining = deadline - Date.now();
        if (remaining <= 0) return ocrError('Waktu menyiapkan scan TokenMurah habis. Coba lagi.', 504);
        const signal = AbortSignal.any([request.signal, AbortSignal.timeout(remaining)]);
        const result = await requestTokenMurahOcr(settings, base64, mimeType, QUIZ_OCR_PROMPTS[kind], signal);
        if ('error' in result) return ocrError(result.error, result.status);
        try {
            return NextResponse.json({ data: parseResult(result.text) });
        } catch {
            return ocrError('Model TokenMurah mengembalikan format OCR yang belum bisa dibaca.', 502);
        }
    }

    const usesPersonalKeys = personalGeminiKeys !== undefined;
    const keys = usesPersonalKeys
        ? readPersonalGeminiKeys(personalGeminiKeys)
        : getOcrGeminiKeys(process.env.GEMINI_API_KEYS, process.env.GEMINI_API_KEY);
    if (!keys) return ocrError('Format API key pribadi tidak valid. Pisahkan setiap key dengan koma.', 400);
    if (!keys.length) return ocrError('API key Gemini belum dikonfigurasi di dashboard.', 503);
    const firstKey = usesPersonalKeys ? 0 : nextKeyIndex % keys.length;
    if (!usesPersonalKeys) nextKeyIndex = (firstKey + 1) % keys.length;

    const result = await runOcrGeminiRotation(keys, firstKey, deadline, request.signal, async ({ key, model, signal }) => {
        const ai = new GoogleGenAI({ apiKey: key });
        const response = await ai.models.generateContent({
            model,
            contents: [{ inlineData: { mimeType, data: base64 } }, QUIZ_OCR_PROMPTS[kind]],
            config: {
                responseMimeType: 'application/json',
                thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
                // AbortSignal menjaga tenggat lokal tanpa mengirim deadline di bawah minimum Gemini.
                httpOptions: { retryOptions: { attempts: 1 } },
                abortSignal: signal,
            },
        });
        return parseResult(response.text ?? '');
    }, data => !data.solutions.length && ('questions' in data
        ? !data.questions.length && !data.passages.length
        : !Object.keys(data.choices).length));

    if ('data' in result) return NextResponse.json({ data: result.data });

    const errors = {
        access: ['Gemini menolak API key. Periksa izin dan status key di Google AI Studio.', 502],
        quota: ['Kuota Gemini tercapai (429).', 429],
        busy: ['Layanan Gemini sedang tidak tersedia (5xx).', 503],
        timeout: ['Gemini terlalu lama merespons.', 504],
        format: ['Respons OCR dari Gemini belum bisa dibaca.', 502],
        network: ['Koneksi ke Gemini gagal.', 502],
        request: ['Gemini menolak permintaan OCR.', 502],
        model: ['Model OCR Gemini tidak tersedia untuk key yang dicoba.', 502],
    } as const;
    const [message, status] = errors[result.failure];
    const source = usesPersonalKeys ? 'pribadi' : 'dashboard';
    return ocrError(`${message} OCR mencoba ${result.triedKeys} dari ${keys.length} API key ${source}.`, status);
}
