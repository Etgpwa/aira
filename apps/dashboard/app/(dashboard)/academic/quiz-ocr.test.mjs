import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveOcrQuestions } from './quiz-ocr.ts';

function question(number, extra = {}) {
    return {
        draft_id: String(number),
        question_text: `Teks asli ${number}`,
        question_type: 'ESSAY',
        option_a: null, option_b: null, option_c: null, option_d: null,
        correct_answer: '?',
        subject_name: 'Statistika',
        source_number: number,
        reference_numbers: [],
        references_previous: false,
        ocr_images: [],
        failed_crops: 0,
        ...extra,
    };
}

test('merangkai rujukan lintas foto meski nomor dipindai terbalik', () => {
    const [fifth] = resolveOcrQuestions([
        question(5, { references_previous: true }),
        question(4, { reference_numbers: [3] }),
        question(3, { question_text: 'Sampel berjumlah 150 orang.' }),
    ], []);

    assert.match(fifth.context, /soal asli nomor 3\nSampel berjumlah 150 orang\./);
    assert.match(fifth.context, /soal asli nomor 4\nTeks asli 4/);
    assert.deepEqual(fifth.issues, []);
});

test('mengenali nama kasus lintas foto walau sumbernya tidak bernomor', () => {
    const [fifth] = resolveOcrQuestions(
        [question(5, { referenced_cases: ['PT Sinar'] })],
        [{ first_number: null, last_number: null, case_name: 'PT. SINAR', text: 'Data penjualan asli.', ocr_images: [], failed_crops: 0 }],
    );
    assert.equal(fifth.context, 'Data penjualan asli.');
    assert.deepEqual(fifth.issues, []);
});

test('menyalin bacaan lintas halaman dan visual rujukan tanpa menyalin gambar solusi', () => {
    const [fifth] = resolveOcrQuestions([
        question(5, { reference_numbers: [4] }),
        question(4, {
            question_type: 'MCQ',
            correct_answer: 'Kunci rahasia',
            ocr_images: [
                { field: 'question_text', data: 'grafik-soal' },
                { field: 'option_a', data: 'opsi-bergambar' },
                { field: 'correct_answer', data: 'solusi' },
            ],
        }),
    ], [{
        first_number: 4, last_number: 5, text: 'Bacaan yang dipakai bersama.',
        ocr_images: [{ field: 'question_text', data: 'tabel-bacaan' }], failed_crops: 0,
    }]);

    assert.equal(fifth.context.split('Bacaan yang dipakai bersama.').length, 2);
    assert.doesNotMatch(fifth.context, /Kunci rahasia/);
    assert.deepEqual(fifth.images.map(image => image.data), ['tabel-bacaan', 'grafik-soal', 'opsi-bergambar']);
    assert.ok(fifth.images.every(image => image.field === 'question_text'));
    assert.match(fifth.images[2].label, /Opsi A, soal asli nomor 4/);
});

test('menandai rujukan hilang dan nomor ambigu tanpa menebak sasaran', () => {
    const [first] = resolveOcrQuestions([
        question(10, { references_previous: true, reference_numbers: [4, 8], failed_crops: 1 }),
        question(4),
        question(4),
    ], []);

    assert.equal(first.context, '');
    assert.match(first.issues.join(' '), /nomor 4 ambigu/);
    assert.match(first.issues.join(' '), /nomor 8 belum ditemukan/);
    assert.match(first.issues.join(' '), /sebelumnya belum bisa dipastikan/);
    assert.match(first.issues.join(' '), /potongan gambar yang gagal/);
});

test('memasangkan gambar pembahasan dari foto terpisah hanya ke nomor yang cocok', () => {
    const [fourth, fifth] = resolveOcrQuestions(
        [question(4), question(5, { reference_numbers: [4] })],
        [],
        [{ source_number: 4, ocr_images: [{ field: 'correct_answer', data: 'solusi' }], failed_crops: 0 }],
    );
    assert.deepEqual(fourth.images, [{ field: 'correct_answer', data: 'solusi' }]);
    assert.deepEqual(fifth.images, []);
});

test('menghentikan rujukan yang melingkar tanpa menyalin soal itu sendiri', () => {
    const [first] = resolveOcrQuestions([
        question(1, { reference_numbers: [2] }),
        question(2, { reference_numbers: [1] }),
    ], []);

    assert.match(first.context, /Teks asli 2/);
    assert.doesNotMatch(first.context, /Teks asli 1/);
});
