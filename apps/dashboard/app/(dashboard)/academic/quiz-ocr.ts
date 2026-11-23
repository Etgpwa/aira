export const QUIZ_FIELDS = ['question_text', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_answer'] as const;
export type QuizField = typeof QUIZ_FIELDS[number];
export const MAX_IMAGE_BASE64 = 96_000;

export interface QuizImage {
    field: QuizField;
    data: string;
    label?: string;
}

export interface OcrQuestion {
    draft_id: string;
    question_text: string;
    question_type: 'MCQ' | 'ESSAY';
    option_a: string | null;
    option_b: string | null;
    option_c: string | null;
    option_d: string | null;
    correct_answer: string;
    subject_name: string;
    source_number: number | null;
    reference_numbers: number[];
    references_previous: boolean;
    case_name?: string;
    referenced_cases?: string[];
    ocr_images: QuizImage[];
    failed_crops: number;
}

export interface OcrPassage {
    first_number: number | null;
    last_number: number | null;
    case_name?: string;
    text: string;
    ocr_images: QuizImage[];
    failed_crops: number;
}

export interface OcrSolution {
    source_number: number;
    ocr_images: QuizImage[];
    failed_crops: number;
}

export type ImageRegion = { field: QuizField; box: [number, number, number, number] };
export type OcrPage = {
    questions: (Omit<OcrQuestion, 'ocr_images' | 'failed_crops'> & { regions: ImageRegion[] })[];
    passages: (Omit<OcrPassage, 'ocr_images' | 'failed_crops'> & { regions: ImageRegion[] })[];
    solutions: (Omit<OcrSolution, 'ocr_images' | 'failed_crops'> & { regions: ImageRegion[] })[];
};

export function resolveOcrQuestions(questions: OcrQuestion[], passages: OcrPassage[], solutions: OcrSolution[] = []) {
    const caseKey = (name?: string) => name?.normalize('NFKC').toLowerCase().replace(/[\s.,()'"’“”:-]+/g, '') ?? '';
    const byNumber = new Map<number, number[]>();
    questions.forEach(({ source_number }, index) => {
        if (source_number !== null) {
            byNumber.set(source_number, [...(byNumber.get(source_number) ?? []), index]);
        }
    });

    return questions.map((question, rootIndex) => {
        const context = new Set<string>();
        const contextImages = new Map<QuizImage, string>();
        const issues = new Set<string>();
        const visited = new Set([rootIndex]);

        function addPassage(passage: OcrPassage) {
            if (passage.text) context.add(passage.text);
            const label = passage.case_name
                ? `Bacaan ${passage.case_name}`
                : `Bacaan soal asli ${passage.first_number}–${passage.last_number}`;
            passage.ocr_images.forEach(image => contextImages.set(image, label));
            if (passage.failed_crops) issues.add('Potongan gambar pada bacaan bersama gagal dibuat.');
        }

        function visit(index: number) {
            const source = questions[index];
            const number = source.source_number;
            for (const passage of passages) {
                if (number === null || passage.first_number === null || passage.last_number === null
                    || number < passage.first_number || number > passage.last_number) continue;
                if ((byNumber.get(number)?.length ?? 0) > 1) {
                    issues.add(`Bacaan bersama untuk nomor ${number} ambigu karena nomornya muncul lebih dari sekali.`);
                    continue;
                }
                addPassage(passage);
            }

            const numberRefs = source.reference_numbers.map(reference => {
                const matches = byNumber.get(reference);
                if (matches?.length === 1) return matches[0];
                issues.add(matches?.length
                    ? `Rujukan nomor ${reference} ambigu karena nomornya muncul lebih dari sekali.`
                    : `Soal rujukan nomor ${reference} belum ditemukan.`);
                return undefined;
            });

            if (source.references_previous) {
                const previousNumber = number === null ? null : number - 1;
                const matches = previousNumber === null ? undefined : byNumber.get(previousNumber);
                if (matches?.length === 1) numberRefs.push(matches[0]);
                else if (previousNumber === null && index > 0) numberRefs.push(index - 1);
                else issues.add('Soal sebelumnya belum bisa dipastikan.');
            }

            for (const name of source.referenced_cases ?? []) {
                const key = caseKey(name);
                if (!key) continue;
                const cases = passages.filter(passage => caseKey(passage.case_name) === key);
                const matches = questions.map((candidate, i) => caseKey(candidate.case_name) === key ? i : -1)
                    .filter(i => i >= 0 && i !== index);
                const total = cases.length + matches.length;
                if (total === 1 && cases.length) addPassage(cases[0]);
                else if (total === 1) numberRefs.push(matches[0]);
                else issues.add(total ? `Kasus “${name}” memiliki lebih dari satu sumber.` : `Sumber kasus “${name}” belum ditemukan.`);
            }

            for (const refIndex of numberRefs) {
                if (refIndex === undefined || visited.has(refIndex)) continue;
                visited.add(refIndex);
                visit(refIndex);
                const target = questions[refIndex];
                const label = target.source_number === null ? 'soal sebelumnya' : `soal asli nomor ${target.source_number}`;
                target.ocr_images.filter(image => image.field === 'question_text')
                    .forEach(image => contextImages.set(image, `Gambar ${label}`));
                const options = QUIZ_FIELDS.slice(1, 5).map((field, optionIndex) => {
                    const text = target[field];
                    const images = target.ocr_images.filter(image => image.field === field);
                    const letter = 'ABCD'[optionIndex];
                    images.forEach(image => contextImages.set(image, `Opsi ${letter}, ${label}`));
                    if (!text && !images.length) return '';
                    return `${letter}. ${text || '[lihat gambar opsi pada konteks]'}`;
                }).filter(Boolean);
                context.add([`Rujukan ${label}`, target.question_text, ...options].join('\n'));
            }
            if (source.failed_crops) issues.add('Ada potongan gambar yang gagal dibuat.');
        }

        visit(rootIndex);
        const matchingSolutions = solutions.filter(solution => solution.source_number === question.source_number);
        const uniqueSourceNumber = question.source_number !== null && byNumber.get(question.source_number)?.length === 1;
        if (matchingSolutions.length && !uniqueSourceNumber) {
            issues.add('Gambar solusi belum bisa dipasangkan karena nomor soal muncul lebih dari sekali.');
        }
        const ownSolutions = uniqueSourceNumber ? matchingSolutions : [];
        if (ownSolutions.some(solution => solution.failed_crops)) issues.add('Ada potongan gambar solusi yang gagal dibuat.');
        // Di soal kuis, visual rujukan selalu tampil bersama konteks, termasuk opsi dari soal sumber.
        const images = [
            ...Array.from(contextImages, ([image, label]) => ({ ...image, field: 'question_text' as const, label })),
            ...question.ocr_images,
            ...ownSolutions.flatMap(solution => solution.ocr_images),
        ];
        const uniqueImages = Array.from(new Map(images.map(image => [`${image.field}:${image.label ?? ''}:${image.data}`, image])).values());
        return { context: Array.from(context).join('\n\n'), images: uniqueImages, issues: Array.from(issues) };
    });
}
