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

export const MAX_OCR_PHOTO_BASE64 = 3_500_000;
export const OCR_CLIENT_TIMEOUT_MS = 36_000;
export const MAX_PERSONAL_KEY_INPUT = 2048;

export function readPersonalGeminiKeys(value: unknown): string[] | null {
    if (typeof value !== 'string' || value.length > MAX_PERSONAL_KEY_INPUT) return null;
    const keys = value.split(',').map(key => key.trim()).filter(Boolean);
    if (!keys.length || keys.some(key => key.length > 256 || !/^(?:AQ\.)?[A-Za-z0-9_-]{16,}$/.test(key))) return null;
    return Array.from(new Set(keys));
}

export type OcrStrip = { top: number; height: number };

export function planOcrStrips(width: number, height: number): OcrStrip[] {
    if (height <= 2000 || height < width * 1.9) return [{ top: 0, height }];

    // Keep enough vertical overlap for a question and its choices near a cut.
    const stripHeight = Math.min(height, Math.max(900, Math.ceil(width * 1.45), Math.ceil(height / 6)));
    const span = height - stripHeight;
    const intervals = Math.max(1, Math.ceil(span / (stripHeight * 0.8)));
    return Array.from({ length: intervals + 1 }, (_, index) => ({
        top: Math.round(span * index / intervals), height: stripHeight,
    }));
}

function rebaseRegions(regions: ImageRegion[], strip: OcrStrip | null, fullHeight: number): ImageRegion[] {
    if (!strip || strip.height === fullHeight) return regions;
    return regions.map(region => {
        const box = region.box;
        if (!Array.isArray(box) || box.length !== 4 || !box.every(n => Number.isFinite(n) && n >= 0 && n <= 1000)) return region;
        const [top, left, bottom, right] = box;
        const translate = (y: number) => Math.round((strip.top * 1000 + y * strip.height) / fullHeight);
        return { ...region, box: [translate(top), left, translate(bottom), right] };
    });
}

function combineRegions(left: ImageRegion[], right: ImageRegion[]): ImageRegion[] {
    const merged = [...left];
    const area = ([top, x, bottom, end]: ImageRegion['box']) => Math.max(0, bottom - top) * Math.max(0, end - x);
    for (const region of right) {
        if (!Array.isArray(region.box) || region.box.length !== 4) {
            merged.push(region);
            continue;
        }
        const [top, x, bottom, end] = region.box;
        const match = merged.findIndex(candidate => {
            if (candidate.field !== region.field || !Array.isArray(candidate.box) || candidate.box.length !== 4) return false;
            const [a, b, c, d] = candidate.box;
            const overlap = Math.max(0, Math.min(bottom, c) - Math.max(top, a))
                * Math.max(0, Math.min(end, d) - Math.max(x, b));
            return overlap > 0 && overlap >= 0.7 * Math.min(area(candidate.box), area(region.box));
        });
        if (match < 0) merged.push(region);
        else if (area(region.box) > area(merged[match].box)) merged[match] = region;
    }
    return merged;
}

function sameOcrText(first: string, second: string) {
    const normalize = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').trim();
    const left = normalize(first);
    const right = normalize(second);
    return left === right || (Math.min(left.length, right.length) >= 24
        && (left.includes(right) || right.includes(left)));
}

export function mergeOcrStrips(
    scans: readonly { page: OcrPage; strip: OcrStrip | null }[], fullHeight: number,
): OcrPage {
    if (scans.length === 1 && (scans[0].strip === null || scans[0].strip.height === fullHeight)) return scans[0].page;
    const result: OcrPage = { questions: [], passages: [], solutions: [] };
    const questionStrips: { top: number; bottom: number }[] = [];
    for (const { page, strip } of scans) {
        const top = strip?.top ?? 0;
        const bottom = top + (strip?.height ?? fullHeight);
        for (const source of page.questions) {
            const question = { ...source, regions: rebaseRegions(source.regions, strip, fullHeight) };
            const match = result.questions.findIndex((previous, index) => questionStrips[index].top < top
                && questionStrips[index].bottom > top
                && (previous.question_text || (previous.source_number !== null && previous.source_number === question.source_number))
                && (previous.source_number === question.source_number || previous.source_number === null || question.source_number === null)
                && sameOcrText(previous.question_text, question.question_text));
            if (match < 0) {
                result.questions.push(question);
                questionStrips.push({ top, bottom });
                continue;
            }
            const previous = result.questions[match];
            const primary = question.question_text.length > previous.question_text.length ? question : previous;
            const other = primary === question ? previous : question;
            const answers = [primary.correct_answer, other.correct_answer].filter(answer => answer !== '?');
            result.questions[match] = {
                ...primary,
                draft_id: previous.draft_id,
                source_number: primary.source_number ?? other.source_number,
                option_a: primary.option_a ?? other.option_a,
                option_b: primary.option_b ?? other.option_b,
                option_c: primary.option_c ?? other.option_c,
                option_d: primary.option_d ?? other.option_d,
                question_type: primary.question_type === 'MCQ' || other.question_type === 'MCQ' ? 'MCQ' : 'ESSAY',
                correct_answer: new Set(answers).size === 1 ? answers[0] : '?',
                reference_numbers: Array.from(new Set([...primary.reference_numbers, ...other.reference_numbers])),
                references_previous: primary.references_previous || other.references_previous,
                referenced_cases: Array.from(new Set([...(primary.referenced_cases ?? []), ...(other.referenced_cases ?? [])])),
                case_name: primary.case_name ?? other.case_name,
                regions: combineRegions(primary.regions, other.regions),
            };
            questionStrips[match] = { top, bottom };
        }
        for (const source of page.passages) {
            const passage = { ...source, regions: rebaseRegions(source.regions, strip, fullHeight) };
            const previous = result.passages.find(item => item.first_number === passage.first_number
                && item.last_number === passage.last_number && item.case_name === passage.case_name
                && sameOcrText(item.text, passage.text));
            if (!previous) result.passages.push(passage);
            else {
                if (passage.text.length > previous.text.length) previous.text = passage.text;
                previous.regions = combineRegions(previous.regions, passage.regions);
            }
        }
        for (const source of page.solutions) {
            const solution = { ...source, regions: rebaseRegions(source.regions, strip, fullHeight) };
            const previous = result.solutions.find(item => item.source_number === solution.source_number);
            if (previous) previous.regions = combineRegions(previous.regions, solution.regions);
            else result.solutions.push(solution);
        }
    }
    return result;
}

export type AcademicOcrResults = {
    questions: OcrPage;
    answer_key: Record<number, string>;
};

function readOcrJson(raw: string): unknown {
    try {
        return JSON.parse(raw);
    } catch {
        // Beberapa respons menyertakan pagar Markdown atau teks pengantar.
    }
    const text = (raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? raw).trim();
    const start = text.search(/[\[{]/);
    const end = text.lastIndexOf(text[start] === '[' ? ']' : '}');
    if (start === -1 || end <= start) throw new SyntaxError('Respons OCR tidak berisi JSON');
    return JSON.parse(text.slice(start, end + 1));
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : undefined;
}

const readText = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const readQuestionNumber = (value: unknown) => {
    const number = typeof value === 'string' && /^\d+$/.test(value.trim()) ? Number(value) : value;
    return isQuestionNumber(number) ? number : null;
};
const readCaseName = (value: unknown) => readText(value).slice(0, 80);
const isQuestionNumber = (value: unknown): value is number =>
    typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

// Keep unknown and duplicate numbers stable; never mutate draft indices used by edits/exclusions.
export function sortQuestionsBySourceNumber<T extends { source_number?: number | null }>(questions: readonly T[]): T[] {
    return [...questions].sort((a, b) => {
        const left = isQuestionNumber(a.source_number) ? a.source_number : Number.POSITIVE_INFINITY;
        const right = isQuestionNumber(b.source_number) ? b.source_number : Number.POSITIVE_INFINITY;
        return left === right ? 0 : left - right;
    });
}

export async function fingerprintOcrPhoto(photo: Blob): Promise<string | null> {
    // Deduplication is optional on browsers without Web Crypto (e.g. local HTTP).
    if (!globalThis.crypto?.subtle) return null;
    const hash = await crypto.subtle.digest('SHA-256', await photo.arrayBuffer());
    return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}

function readRegions(value: unknown): ImageRegion[] {
    return Array.isArray(value)
        ? value.filter(region => region && QUIZ_FIELDS.includes(region.field))
        : [];
}

export function parseOcrPage(raw: string, subjectName: string, createId: () => string): OcrPage {
    const parsed = readOcrJson(raw);
    const page = asRecord(parsed);
    const questions = Array.isArray(parsed) ? parsed : page?.questions;
    const passages = page?.passages;
    const solutions = page?.solutions;
    if (![questions, passages, solutions].some(Array.isArray)) {
        throw new SyntaxError('Respons OCR tidak berisi daftar soal, bacaan, atau solusi');
    }

    return {
        questions: (Array.isArray(questions) ? questions : []).flatMap((value: unknown) => {
            const q = asRecord(value);
            if (!q) return [];
            const questionText = readText(q.question_text);
            const regions = readRegions(q.regions);
            if (!questionText && !regions.some(region => region.field === 'question_text')) return [];
            return [{
                draft_id: createId(),
                question_text: questionText,
                question_type: q.question_type === 'MCQ' ? 'MCQ' : 'ESSAY',
                option_a: readText(q.option_a) || null,
                option_b: readText(q.option_b) || null,
                option_c: readText(q.option_c) || null,
                option_d: readText(q.option_d) || null,
                correct_answer: readText(q.correct_answer) || '?',
                source_number: readQuestionNumber(q.source_number),
                reference_numbers: Array.isArray(q.reference_numbers)
                    ? q.reference_numbers.map(readQuestionNumber).filter(isQuestionNumber)
                    : [],
                references_previous: q.references_previous === true,
                case_name: readCaseName(q.case_name) || undefined,
                referenced_cases: Array.isArray(q.referenced_cases) ? q.referenced_cases.map(readCaseName).filter(Boolean) : [],
                regions,
                subject_name: subjectName,
            }];
        }),
        passages: (Array.isArray(passages) ? passages : []).flatMap((value: unknown) => {
            const passage = asRecord(value);
            if (!passage) return [];
            const first = readQuestionNumber(passage.first_number);
            const last = readQuestionNumber(passage.last_number);
            const hasRange = first !== null && last !== null && first <= last;
            const caseName = readCaseName(passage.case_name);
            if (!hasRange && !caseName) return [];
            return [{
                first_number: hasRange ? first : null,
                last_number: hasRange ? last : null,
                case_name: caseName || undefined,
                text: readText(passage.text),
                regions: readRegions(passage.regions).filter(region => region.field === 'question_text'),
            }];
        }),
        solutions: (Array.isArray(solutions) ? solutions : []).flatMap((value: unknown) => {
            const solution = asRecord(value);
            const number = readQuestionNumber(solution?.source_number);
            if (!solution || number === null) return [];
            const regions = readRegions(solution.regions).filter(region => region.field === 'correct_answer');
            return regions.length ? [{ source_number: number, regions }] : [];
        }),
    };
}

export function parseOcrAnswerKey(raw: string): Record<number, string> {
    const parsed = asRecord(readOcrJson(raw));
    if (!parsed) throw new SyntaxError('Respons kunci jawaban bukan objek JSON');
    return Object.fromEntries(Object.entries(parsed).flatMap(([number, value]) => {
        const answer = readText(value).toUpperCase();
        return /^[1-9]\d*$/.test(number) && /^[A-E]$/.test(answer) ? [[number, answer]] : [];
    }));
}

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
