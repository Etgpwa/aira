import type { TokenMurahOcrSettings } from '@/app/(dashboard)/academic/quiz-ocr';

type TokenMurahError = { error: string; status: number };

function explainError(status: number, code?: string): TokenMurahError {
    if (status === 401 || status === 403) {
        return { error: 'TokenMurah menolak API key. Periksa status key dan akses model di dashboard TokenMurah.', status: 502 };
    }
    if (status === 402) return { error: 'Saldo atau kuota TokenMurah kurang untuk scan ini.', status };
    if (code === 'model_not_found' || status === 404) {
        return { error: 'Model tidak tersedia di TokenMurah untuk key ini. Salin ID model vision dari katalog yang sesuai.', status: 502 };
    }
    if (status === 429) return { error: 'Batas request TokenMurah tercapai. Tunggu sebentar lalu coba lagi.', status };
    if (status === 408 || status === 504) return { error: 'TokenMurah terlalu lama merespons. Periksa Log request sebelum mencoba lagi.', status: 504 };
    if (status >= 500) return { error: 'Layanan TokenMurah sedang tidak tersedia. Periksa Log request sebelum mencoba lagi.', status: 503 };
    return { error: 'TokenMurah menolak scan. Pastikan model menerima gambar lewat Chat Completions dan gunakan JPG, PNG, atau WebP.', status: 502 };
}

export async function requestTokenMurahOcr(
    settings: TokenMurahOcrSettings, base64: string, mimeType: string, prompt: string, signal: AbortSignal,
): Promise<{ text: string } | TokenMurahError> {
    if (!/^image\/(jpeg|png|webp)$/.test(mimeType)) {
        return { error: 'Untuk TokenMurah, gunakan foto JPG, PNG, atau WebP.', status: 400 };
    }

    try {
        const response = await fetch('https://tokenmurah.net/v1/chat/completions', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${settings.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: settings.model,
                messages: [{
                    role: 'user',
                    content: [
                        { type: 'text', text: prompt },
                        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}`, detail: 'high' } },
                    ],
                }],
                stream: false,
            }),
            signal,
            redirect: 'error',
            cache: 'no-store',
        });
        const payload = await response.json().catch(() => null);
        if (signal.aborted) return explainError(504);
        if (!response.ok) return explainError(response.status, payload?.error?.code);

        const choice = payload?.choices?.[0];
        if (choice?.finish_reason === 'length') {
            return { error: 'Hasil TokenMurah terpotong. Scan bagian foto yang lebih kecil.', status: 502 };
        }
        const text = choice?.message?.content;
        if (typeof text !== 'string' || !text.trim()) {
            return { error: 'Model TokenMurah tidak mengembalikan teks OCR untuk foto ini.', status: 502 };
        }
        return { text };
    } catch {
        return signal.aborted ? explainError(504) : {
            error: 'Koneksi ke TokenMurah gagal. Periksa Log request sebelum mencoba lagi.',
            status: 502,
        };
    }
}
