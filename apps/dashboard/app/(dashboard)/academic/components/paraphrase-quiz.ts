import { batchParaphraseQuestions } from '../actions';
import type { QuizBankQuestion } from '../quiz-bank';

export async function paraphraseTextQuestions(questions: QuizBankQuestion[]) {
    const canParaphrase = (question: QuizBankQuestion) => question.question_type !== 'ESSAY' && !question.ocr_images?.length;
    const textQuestions = questions.filter(canParaphrase);
    const paraphrased: QuizBankQuestion[] = [];
    for (let offset = 0; offset < textQuestions.length; offset += 10) {
        const batch = textQuestions.slice(offset, offset + 10);
        try {
            const result = await batchParaphraseQuestions(batch);
            paraphrased.push(...result.questions);
        } catch {
            paraphrased.push(...batch.map(question => ({ ...question, is_paraphrased: false })));
        }
    }
    let index = 0;
    return questions.map(question => canParaphrase(question)
        ? paraphrased[index++]
        : { ...question, is_paraphrased: false });
}
