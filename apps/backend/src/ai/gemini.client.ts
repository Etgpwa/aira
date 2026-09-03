import { GoogleGenAI } from '@google/genai';

// Manager API Keys: Mendukung multi-key (GEMINI_API_KEYS koma-terpisah atau GEMINI_API_KEY tunggal)
class ApiKeyManager {
    private keys: string[] = [];
    private currentIndex: number = 0;

    constructor() {
        this.reloadKeys();
    }

    reloadKeys() {
        const rawKeys = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
        this.keys = rawKeys
            .split(',')
            .map(k => k.trim())
            .filter(k => k.length > 0);

        if (this.keys.length === 0) {
            console.error("⚠️ WARNING: Belum ada GEMINI_API_KEY atau GEMINI_API_KEYS di file .env!");
        } else {
            console.log(`🔑 Loaded ${this.keys.length} Gemini API Key(s) untuk rotasi.`);
        }
    }

    getCurrentKey(): string {
        if (this.keys.length === 0) return '';
        return this.keys[this.currentIndex];
    }

    rotateToNextKey(): string {
        if (this.keys.length <= 1) return this.getCurrentKey();
        this.currentIndex = (this.currentIndex + 1) % this.keys.length;
        console.warn(`🔄 Beralih ke Gemini API Key index [${this.currentIndex + 1}/${this.keys.length}]`);
        return this.getCurrentKey();
    }

    get totalKeys(): number {
        return this.keys.length;
    }
}

export const apiKeyManager = new ApiKeyManager();

// Helper untuk mendapatkan instance Gemini AI secara dinamis
const getGenAI = (apiKey?: string) => {
    const key = apiKey || apiKeyManager.getCurrentKey();
    return new GoogleGenAI({ apiKey: key });
};

// Nama model aktif yang sudah dikonfirmasi berjalan di free tier
const GEMINI_MODEL = 'gemini-3.5-flash';

// Simple Queue System untuk mengatur jeda dan rotasi API Key jika terkena limit 429
type QueueItem = {
    task: (ai: GoogleGenAI) => Promise<any>;
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
};

class GeminiQueue {
    private queue: QueueItem[] = [];
    private isProcessing = false;
    // Jeda antar request: semakin banyak key, jeda bisa semakin kecil
    private get delayMs() {
        const keyCount = Math.max(1, apiKeyManager.totalKeys);
        return Math.max(1000, Math.floor(4100 / keyCount));
    }

    async add<T>(task: (ai: GoogleGenAI) => Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            this.queue.push({ task, resolve, reject });
            if (!this.isProcessing) {
                this.process();
            }
        });
    }

    private async process() {
        if (this.queue.length === 0) {
            this.isProcessing = false;
            return;
        }

        this.isProcessing = true;
        const item = this.queue.shift();

        if (item) {
            let maxAttempts = Math.max(3, apiKeyManager.totalKeys * 2);
            let success = false;

            while (maxAttempts > 0 && !success) {
                try {
                    const ai = getGenAI();
                    const result = await item.task(ai);
                    item.resolve(result);
                    success = true;
                } catch (error: any) {
                    const isRateLimitOrOverload = error?.status === 429 || error?.status === 503 || error?.status === 500 ||
                        String(error).includes('429') || String(error).includes('503') || String(error).includes('500') ||
                        String(error).includes('exceeded your') || String(error).includes('overloaded') || String(error).includes('UNAVAILABLE');

                    if (isRateLimitOrOverload) {
                        console.warn(`⚠️ Rate limit / Google Server Overload (429/503) terdeteksi: ${error?.message || error}`);
                        if (apiKeyManager.totalKeys > 1) {
                            apiKeyManager.rotateToNextKey();
                            console.log(`🚀 Mencoba kembali langsung menggunakan Key berikutnya...`);
                            maxAttempts--;
                            continue;
                        } else {
                            console.warn(`⚠️ Menunggu 5 detik sebelum retry... (sisa retry: ${maxAttempts - 1})`);
                            await new Promise(res => setTimeout(res, 5000));
                            maxAttempts--;
                        }
                    } else {
                        console.error("Gemini API Error:", error);
                        item.reject(error);
                        break;
                    }
                }
            }
        }

        // Jeda dinamis sebelum memproses request berikutnya
        await new Promise(res => setTimeout(res, this.delayMs));
        this.process();
    }
}

export const geminiQueue = new GeminiQueue();

/**
 * Helper function untuk mengirim request teks ke Gemini dengan antrian (Queue)
 */
export const askGemini = async (prompt: string, systemInstruction?: string): Promise<string> => {
    return geminiQueue.add(async (ai) => {
        const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: prompt,
            ...(systemInstruction ? { config: { systemInstruction } } : {})
        });
        return response.text ?? '';
    });
};

/**
 * Helper function untuk mengirim gambar (Multimodal / Vision) ke Gemini
 */
export const askGeminiVision = async (
    imageBuffer: Buffer,
    mimeType: string,
    prompt: string,
    systemInstruction?: string
): Promise<string> => {
    return geminiQueue.add(async (ai) => {
        const base64Data = imageBuffer.toString('base64');
        const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: [
                {
                    inlineData: {
                        mimeType: mimeType || 'image/jpeg',
                        data: base64Data
                    }
                },
                prompt
            ],
            ...(systemInstruction ? { config: { systemInstruction } } : {})
        });
        return response.text ?? '';
    });
};

