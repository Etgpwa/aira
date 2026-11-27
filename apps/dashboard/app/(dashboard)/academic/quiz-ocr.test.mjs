import assert from 'node:assert/strict';
import test from 'node:test';
import {
    mergeOcrStrips, planOcrStrips, readPersonalGeminiKeys, parseOcrAnswerKey,
    parseOcrPage, resolveOcrQuestions, sortQuestionsBySourceNumber, fingerprintOcrPhoto, readTokenMurahOcrSettings,
    convertQuizToEssay, moveQuizOptionImagesToPrompt,
} from './quiz-ocr.ts';

test('merencanakan potongan foto panjang yang menutup gambar dan saling tumpang tindih', () => {
    assert.deepEqual(planOcrStrips(1200, 1600), [{ top: 0, height: 1600 }]);
    const strips = planOcrStrips(1200, 5000);
    assert.equal(strips[0].top, 0);
    assert.equal(strips.at(-1).top + strips.at(-1).height, 5000);
    assert.ok(strips.length > 1 && strips.every(strip => strip.height < 2000));
    assert.ok(strips.slice(1).every((strip, index) => strip.top < strips[index].top + strips[index].height));
});

test('menyatukan soal tumpang tindih dan memetakan grafik ke foto asli', () => {
    const first = parseOcrPage(JSON.stringify({
        questions: [{ source_number: 4, question_text: 'Perhatikan grafik jumlah buku berikut.' }],
    }), '', () => 'first');
    const next = parseOcrPage(JSON.stringify({
        questions: [
            { source_number: 4, question_text: 'Perhatikan grafik jumlah buku berikut. Hitung total buku.', regions: [{ field: 'question_text', box: [100, 200, 400, 800] }] },
            { source_number: 5, question_text: 'Berdasarkan grafik pada soal 4, pilih kategori terbesar.', reference_numbers: ['4'] },
        ],
    }), '', () => 'next');
    const result = mergeOcrStrips([
        { page: first, strip: { top: 0, height: 1500 } },
        { page: next, strip: { top: 1000, height: 1500 } },
    ], 2500);
    assert.deepEqual(result.questions.map(item => item.source_number), [4, 5]);
    assert.equal(result.questions[0].draft_id, 'first');
    assert.match(result.questions[0].question_text, /Hitung total buku/);
    assert.deepEqual(result.questions[0].regions[0].box, [460, 200, 640, 800]);
    assert.deepEqual(result.questions[1].reference_numbers, [4]);
});

test('menerima key pribadi yang dipisah koma dan menolak format lain', () => {
    const first = 'example_private_key_1';
    const second = 'example-private-key-2';
    assert.deepEqual(readPersonalGeminiKeys(` ${first}, ${second}, ${first} `), [first, second]);
    assert.equal(readPersonalGeminiKeys([first]), null);
    assert.equal(readPersonalGeminiKeys(''), null);
    assert.equal(readPersonalGeminiKeys(`${first},https://example.com/`), null);
});

test('menerima key otorisasi AQ. bersama key standar tanpa mengubah isinya', () => {
    const authKey = 'AQ.example_authorization_key_123';
    const standardKey = 'AIzaExample_standard_key_123';
    assert.deepEqual(readPersonalGeminiKeys(authKey), [authKey]);
    assert.deepEqual(readPersonalGeminiKeys(` ${standardKey}, ${authKey}, ${authKey} `), [standardKey, authKey]);
    assert.equal(readPersonalGeminiKeys('AQ.'), null);
    assert.equal(readPersonalGeminiKeys('AQ..example_authorization_key'), null);
    assert.equal(readPersonalGeminiKeys('AQ.example authorization key'), null);
    assert.equal(readPersonalGeminiKeys(`AQ.${'a'.repeat(254)}`), null);
});

test('membaca konfigurasi TokenMurah dengan ID model vision dari katalog', () => {
    assert.deepEqual(readTokenMurahOcrSettings({ apiKey: ' sk-tm-example_fake_key ', model: ' gpt-5.4-mini ' }), {
        apiKey: 'sk-tm-example_fake_key', model: 'gpt-5.4-mini',
    });
    assert.deepEqual(readTokenMurahOcrSettings({ apiKey: 'sk-tp-example_fake_key', model: 'model/vision' }), {
        apiKey: 'sk-tp-example_fake_key', model: 'model/vision',
    });
    assert.equal(readTokenMurahOcrSettings({ apiKey: 'AQ.example_gemini_key', model: 'gpt-5.4-mini' }), null);
    assert.equal(readTokenMurahOcrSettings({ apiKey: 'sk-tm-example_fake_key', model: 'https://example.com' }), null);
});
test('menerima daftar soal format lama dan halaman dengan bagian opsional yang hilang', () => {
    const raw = '[{"question_text":"Pilih jenis grafik.","question_type":"MCQ","option_a":"Batang"}]';
    const original = parseOcrPage(`Hasil OCR\n\`\`\`json\n${raw}\n\`\`\`\nSelesai`, 'Statistika', () => 'draft');
    const current = parseOcrPage(`{"questions":${raw}}`, 'Statistika', () => 'draft');
    assert.deepEqual(original, current);
    assert.equal(current.questions[0].question_text, 'Pilih jenis grafik.');
    assert.deepEqual(current.passages, []);
    assert.deepEqual(current.solutions, []);
});

test('menerima halaman khusus pembahasan dan menolak JSON yang terpotong', () => {
    const page = parseOcrPage(
        '{"solutions":[{"source_number":5,"regions":[{"field":"correct_answer","box":[10,20,40,50]}]}]}',
        'Statistika', () => 'draft',
    );
    assert.deepEqual(page.questions, []);
    assert.equal(page.solutions[0].source_number, 5);
    assert.throws(() => parseOcrPage('{"questions":[{"question_text":', '', () => ''), SyntaxError);
});

test('mempertahankan pagar kode jika bagian dari teks soal di JSON yang valid', () => {
    const question_text = 'Jelaskan kode berikut. ```js\nlet a = 1\n```';
    const page = parseOcrPage(JSON.stringify({ questions: [{ question_text }] }), '', () => 'draft');
    assert.equal(page.questions[0].question_text, question_text);
});

test('membaca kunci jawaban dan menolak respons bukan objek', () => {
    assert.deepEqual(parseOcrAnswerKey('{"1":"a","4":"E","catatan":"abaikan","2":"P"}'), {
        choices: { 1: 'A', 4: 'E' }, solutions: [],
    });
    assert.throws(() => parseOcrAnswerKey('[]'), SyntaxError);
});

test('membaca kotak seluruh jawaban esai tanpa mengubahnya menjadi teks atau huruf pilihan', () => {
    const region = { field: 'correct_answer', box: [340, 60, 630, 940] };
    const solution = { source_number: 3, regions: [region] };
    const page = parseOcrAnswerKey(JSON.stringify({
        choices: { 2: 'c', 3: 'penjelasan jawaban' },
        solutions: [
            { ...solution, source_number: '3', regions: [region, { ...region, field: 'question_text' }] },
            { ...solution, source_number: 0 },
        ],
    }));
    assert.deepEqual(page, { choices: { 2: 'C' }, solutions: [solution] });
    assert.deepEqual(parseOcrAnswerKey(JSON.stringify({ solutions: [solution] })), { choices: {}, solutions: [solution] });
});

test('konversi esai mempertahankan subsoal dan gambar OCR serta mengosongkan kunci pilihan ganda', () => {
    const draft = {
        question_type: 'MCQ', question_text: 'Analisis tabel.',
        option_a: 'Hitung jumlah.', option_b: null, option_c: 'Sebutkan penyebab.', option_d: '', correct_answer: 'c',
    };
    assert.deepEqual(convertQuizToEssay(draft), {
        question_type: 'ESSAY', question_text: 'Analisis tabel.\nA. Hitung jumlah.\nC. Sebutkan penyebab.',
        option_a: null, option_b: null, option_c: null, option_d: null, correct_answer: '',
    });
    assert.equal(convertQuizToEssay({ ...draft, correct_answer: 'Jumlahnya 10.' }).correct_answer, 'Jumlahnya 10.');

    const stem = { field: 'question_text', data: 'tabel' };
    const answer = { field: 'correct_answer', data: 'solusi' };
    assert.deepEqual(moveQuizOptionImagesToPrompt([stem, { field: 'option_b', data: 'diagram' }, answer]), [
        stem, { field: 'question_text', data: 'diagram', label: 'Bagian B' }, answer,
    ]);
});

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

test('mengurutkan nomor numerik lintas scan tanpa mengubah identitas draft', () => {
    const original = [question(8), question(10), question(2), question(1)];
    const sorted = sortQuestionsBySourceNumber(original);
    assert.deepEqual(sorted.map(q => q.source_number), [1, 2, 8, 10]);
    assert.deepEqual(original.map(q => q.source_number), [8, 10, 2, 1]);
    assert.equal(sorted[0], original[3]);
});

test('nomor ganda stabil dan nomor tidak diketahui diletakkan terakhir', () => {
    const original = [question(null), question(8), question(2), question(2), question(null)];
    assert.deepEqual(sortQuestionsBySourceNumber(original), [original[2], original[3], original[1], original[0], original[4]]);
});

test('urutan tampilan mempertahankan indeks edit, eksklusi, konteks, dan solusi', () => {
    const original = [question(8, { reference_numbers: [1] }), question(2), question(1)];
    const resolved = resolveOcrQuestions(original, [], [{ source_number: 8, ocr_images: [{ field: 'correct_answer', data: 'solusi8' }], failed_crops: 0 }]);
    const included = sortQuestionsBySourceNumber(original.map((q, index) => ({ question: q, index, source_number: q.source_number })).filter(q => q.index !== 1));
    assert.deepEqual(included.map(q => q.index), [2, 0]);
    assert.match(resolved[included[1].index].context, /Teks asli 1/);
    assert.equal(resolved[included[1].index].images[0].data, 'solusi8');
});

test('parser menerima nomor berupa string angka tanpa menebak nomor kosong', () => {
    const page = parseOcrPage(JSON.stringify({ questions: [
        { question_text: 'Delapan', source_number: '8' },
        { question_text: 'Tidak bernomor', source_number: null },
        { question_text: 'Bukan nomor', source_number: '8abc' },
    ] }), '', () => 'draft');
    assert.deepEqual(page.questions.map(q => q.source_number), [8, null, null]);
});

test('sidik foto mengikuti isi, bukan nama, untuk melewati foto yang sudah berhasil', async () => {
    const first = await fingerprintOcrPhoto(new Blob(['foto-sama']));
    assert.equal(first, await fingerprintOcrPhoto(new Blob(['foto-sama'])));
    assert.notEqual(first, await fingerprintOcrPhoto(new Blob(['foto-berbeda'])));
});
