import { type QuizField, type QuizImage } from '../quiz-ocr';

const labels: Record<QuizField, string> = {
    question_text: 'Gambar soal',
    option_a: 'Gambar opsi A',
    option_b: 'Gambar opsi B',
    option_c: 'Gambar opsi C',
    option_d: 'Gambar opsi D',
    correct_answer: 'Gambar solusi',
};

export function hasQuizImage(images: QuizImage[] | undefined, field: QuizField) {
    return images?.some(image => image.field === field) ?? false;
}

export default function QuizImages({ images, field }: { images?: QuizImage[]; field: QuizField }) {
    return images?.filter(image => image.field === field).map((image, index) => (
        <span key={index} className="block mt-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- potongan WebP sudah dikompresi saat scan */}
            <img src={`data:image/webp;base64,${image.data}`} alt={image.label || labels[field]}
                loading="lazy" decoding="async"
                className="block max-w-full w-auto h-auto max-h-96 object-contain rounded-lg" />
            {image.label && <span className="block text-xs text-secondary mt-1">{image.label}</span>}
        </span>
    ));
}
