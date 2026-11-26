import assert from 'node:assert/strict';
import test from 'node:test';
import { findAnswerKeyQuestion, getQuizScore, shuffleQuizItems } from './quiz-bank.ts';

test('acak bank soal panjang tanpa membuang, menggandakan, atau mengubah urutan sumber', () => {
    const bank = Array.from({ length: 127 }, (_, index) => index + 1);
    const shuffled = shuffleQuizItems(bank);
    assert.equal(shuffled.length, 127);
    assert.deepEqual([...shuffled].sort((a, b) => a - b), bank);
    assert.equal(bank[0], 1);
    assert.notEqual(shuffled, bank);
});

test('skor paket campuran dihitung dari pilihan ganda dan tetap mencatat esai', () => {
    const result = getQuizScore([
        { question_type: 'MCQ', correct_answer: 'D' },
        { question_type: 'ESSAY', correct_answer: 'Penjelasan esai' },
        { question_type: 'MCQ', correct_answer: 'A' },
    ], { 0: 'D', 1: 'Penjelasan esai' });
    assert.deepEqual(result, { correct: 1, gradedCount: 2, essayCount: 1, finalScore: 50 });
});

test('paket esai tidak memiliki pilihan ganda yang dinilai', () => {
    const result = getQuizScore([{ question_type: 'ESSAY', correct_answer: '?' }], {});
    assert.deepEqual(result, { correct: 0, gradedCount: 0, essayCount: 1, finalScore: 0 });
});

test('memasangkan gambar esai dan huruf kunci dengan nomor tercetak serta jenis soal', () => {
    const mcq = { id: 'pilihan', source_number: 1, question_type: 'MCQ' };
    const essay = { id: 'esai', source_number: 1, question_type: 'ESSAY' };
    const legacy = { id: 'lama', question_type: 'ESSAY' };
    const questions = [mcq, essay, legacy];
    assert.equal(findAnswerKeyQuestion(questions, 1, 'MCQ'), mcq);
    assert.equal(findAnswerKeyQuestion(questions, 1, 'ESSAY'), essay);
    assert.equal(findAnswerKeyQuestion(questions, 3, 'ESSAY'), legacy);
    assert.equal(findAnswerKeyQuestion(questions, 3, 'MCQ'), undefined);
    assert.equal(findAnswerKeyQuestion(questions, 2, 'ESSAY'), undefined);
    assert.equal(findAnswerKeyQuestion([...questions, { ...essay, id: 'ganda' }], 1, 'ESSAY'), undefined);
});
