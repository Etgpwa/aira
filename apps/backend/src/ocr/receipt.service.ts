import { askGeminiVision } from '../ai/gemini.client';
import { RECEIPT_OCR_PROMPT } from './prompts/ocr.prompt';

export interface OCRResult {
    merchant: string | null;
    total_amount: number;
    currency: string;
    category: string;
    description: string;
    reply: string;
}

export class ReceiptService {
    async scanReceipt(imageBuffer: Buffer, mimeType: string): Promise<OCRResult | null> {
        try {
            const rawResponse = await askGeminiVision(
                imageBuffer,
                mimeType,
                RECEIPT_OCR_PROMPT
            );

            const cleanJsonStr = rawResponse.replace(/```json/gi, '').replace(/```/gi, '').trim();
            const result: OCRResult = JSON.parse(cleanJsonStr);
            return result;
        } catch (error) {
            console.error("Gagal melakukan OCR struk:", error);
            return null;
        }
    }
}

export const receiptService = new ReceiptService();
