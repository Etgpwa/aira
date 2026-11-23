import { batchParaphraseQuestions } from '../actions';

export async function paraphraseTextQuestions(questions: any[]) {
    const textQuestions = questions.filter(question => !question.ocr_images?.length);
    const { questions: paraphrased } = textQuestions.length
        ? await batchParaphraseQuestions(textQuestions)
        : { questions: [] };
    let index = 0;
    return questions.map(question => question.ocr_images?.length
        ? { ...question, is_paraphrased: false }
        : paraphrased[index++]);
}
