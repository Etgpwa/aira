import { MAX_IMAGE_BASE64, MAX_OCR_PHOTO_BASE64, planOcrStrips, type ImageRegion, type OcrStrip, type QuizImage } from './quiz-ocr';

function compressOcrPhoto(image: HTMLImageElement, strip: OcrStrip | null) {
    const canvas = document.createElement('canvas');
    const { top, height } = strip ?? { top: 0, height: image.naturalHeight };
    const scale = Math.min(1, 2000 / Math.max(image.naturalWidth, height));
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Foto tidak dapat diproses');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, top, image.naturalWidth, height, 0, 0, canvas.width, canvas.height);
    const base64 = canvas.toDataURL('image/jpeg', 0.88).split(',')[1];
    if (!base64) throw new Error('Foto tidak dapat dikompresi.');
    return { base64, mimeType: 'image/jpeg' };
}

export async function prepareOcrFile(file: File, splitLongPhoto = false): Promise<{
    photo: HTMLImageElement | null;
    strips: (OcrStrip | null)[];
    encode: (strip: OcrStrip | null) => { base64: string; mimeType: string };
}> {
    try {
        const photo = await decodeQuizImage(file);
        const strips = splitLongPhoto ? planOcrStrips(photo.naturalWidth, photo.naturalHeight) : [null];
        if (strips.length === 1) {
            const compressed = compressOcrPhoto(photo, strips[0]);
            return { photo, strips, encode: () => compressed };
        }
        return { photo, strips, encode: strip => compressOcrPhoto(photo, strip) };
    } catch {
        // Gemini dapat membaca beberapa format asli yang belum bisa dibuka browser.
        if (Math.ceil(file.size / 3) * 4 > MAX_OCR_PHOTO_BASE64) {
            throw new Error('Foto asli terlalu besar untuk diunggah. Gunakan versi JPG atau PNG yang lebih kecil.');
        }
        const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            const readTimer = setTimeout(() => reader.abort(), 8_000);
            reader.onloadend = () => clearTimeout(readTimer);
            reader.onload = () => {
                const data = typeof reader.result === 'string' ? reader.result.split(',')[1] : '';
                if (data) resolve(data);
                else reject(new Error('File foto kosong.'));
            };
            reader.onerror = reader.onabort = () => reject(new Error('Browser gagal membaca file foto.'));
            reader.readAsDataURL(file);
        });
        return { photo: null, strips: [null], encode: () => ({ base64, mimeType: file.type || 'image/jpeg' }) };
    }
}

async function decodeQuizImage(file: File): Promise<HTMLImageElement> {
    const photo = new Image();
    const url = URL.createObjectURL(file);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        photo.src = url;
        await Promise.race([
            photo.decode(),
            new Promise<never>((_, reject) => {
                timer = setTimeout(() => reject(new Error('Browser terlalu lama membuka foto.')), 8_000);
            }),
        ]);
        return photo;
    } finally {
        clearTimeout(timer);
        URL.revokeObjectURL(url);
    }
}

function encodeQuizWebp(
    image: HTMLImageElement, context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number,
): string | undefined {
    const canvas = context.canvas;
    for (const [maxDim, quality] of [[1400, 0.84], [1200, 0.75], [960, 0.67], [720, 0.6], [520, 0.55]]) {
        const scale = Math.min(1, maxDim / Math.max(width, height));
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        context.fillStyle = '#fff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, x, y, width, height, 0, 0, canvas.width, canvas.height);
        const url = canvas.toDataURL('image/webp', quality);
        if (!url.startsWith('data:image/webp;base64,')) break;
        const data = url.split(',')[1];
        if (data && data.length <= MAX_IMAGE_BASE64) return data;
    }
}

export async function prepareNoteImage(file: File): Promise<string> {
    const image = await decodeQuizImage(file);
    const context = document.createElement('canvas').getContext('2d');
    const data = context && encodeQuizWebp(image, context, 0, 0, image.naturalWidth, image.naturalHeight);
    if (!data) throw new Error('Gambar catatan gagal dikompresi.');
    return data;
}

export function cropQuizImages(image: HTMLImageElement, regions: ImageRegion[]) {
    const images: QuizImage[] = [];
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return { ocr_images: images, failed_crops: regions.length };
    const width = image.naturalWidth;
    const height = image.naturalHeight;

    for (const { field, box } of regions) {
        if (!Array.isArray(box) || box.length !== 4 || !box.every(n => Number.isFinite(n) && n >= 0 && n <= 1000)) continue;
        const [top, left, bottom, right] = box;
        if (top >= bottom || left >= right) continue;
        const x = Math.max(0, Math.floor((left - 5) * width / 1000));
        const y = Math.max(0, Math.floor((top - 5) * height / 1000));
        const cropWidth = Math.min(width, Math.ceil((right + 5) * width / 1000)) - x;
        const cropHeight = Math.min(height, Math.ceil((bottom + 5) * height / 1000)) - y;

        const data = encodeQuizWebp(image, context, x, y, cropWidth, cropHeight);
        if (data) images.push({ field, data });
    }
    return { ocr_images: images, failed_crops: regions.length - images.length };
}
