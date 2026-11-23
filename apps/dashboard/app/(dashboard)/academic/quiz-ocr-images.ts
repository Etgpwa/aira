import { MAX_IMAGE_BASE64, type ImageRegion, type QuizImage } from './quiz-ocr';

export function prepareOcrPhoto(image: HTMLImageElement) {
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 2400 / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Foto tidak dapat diproses');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return { base64: canvas.toDataURL('image/jpeg', 0.86).split(',')[1], mimeType: 'image/jpeg' };
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

        for (const [maxDim, quality] of [[1400, 0.84], [1200, 0.75], [960, 0.67], [720, 0.6], [520, 0.55]]) {
            const scale = Math.min(1, maxDim / Math.max(cropWidth, cropHeight));
            canvas.width = Math.max(1, Math.round(cropWidth * scale));
            canvas.height = Math.max(1, Math.round(cropHeight * scale));
            context.fillStyle = '#fff';
            context.fillRect(0, 0, canvas.width, canvas.height);
            context.drawImage(image, x, y, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
            const url = canvas.toDataURL('image/webp', quality);
            if (!url.startsWith('data:image/webp;base64,')) break;
            const data = url.split(',')[1];
            if (data.length <= MAX_IMAGE_BASE64) {
                images.push({ field, data });
                break;
            }
        }
    }
    return { ocr_images: images, failed_crops: regions.length - images.length };
}
