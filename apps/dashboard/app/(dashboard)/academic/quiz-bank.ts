import type { QuizImage } from './quiz-ocr';

export const EVENT_RANDOM_COUNT = 30;
export const EVENT_QUESTION_BATCH_SIZE = 20;
export type EventQuestionSelection = 'random' | 'all';

export interface QuizBankQuestion {
    id: string;
    source_number?: number | null;
    question_text: string;
    question_type: 'MCQ' | 'ESSAY';
    option_a: string | null;
    option_b: string | null;
    option_c: string | null;
    option_d: string | null;
    correct_answer: string | null;
    user_note?: string | null;
    ocr_images?: QuizImage[];
    is_paraphrased?: boolean;
}

export function shuffleQuizItems<T>(items: readonly T[]): T[] {
    const shuffled = [...items];
    for (let index = shuffled.length - 1; index > 0; index--) {
        const second = Math.floor(Math.random() * (index + 1));
        [shuffled[index], shuffled[second]] = [shuffled[second], shuffled[index]];
    }
    return shuffled;
}

export function getQuizScore(
    questions: readonly Pick<QuizBankQuestion, 'question_type' | 'correct_answer'>[],
    answers: Record<number, string>,
) {
    let correct = 0;
    let gradedCount = 0;
    let essayCount = 0;

    questions.forEach((question, index) => {
        if (question.question_type === 'ESSAY') {
            essayCount++;
            return;
        }
        gradedCount++;
        if (answers[index] && answers[index] === question.correct_answer) correct++;
    });

    return { correct, gradedCount, essayCount, finalScore: gradedCount ? Math.round(correct / gradedCount * 100) : 0 };
}
