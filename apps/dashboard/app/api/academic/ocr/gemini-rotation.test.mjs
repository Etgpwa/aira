import assert from 'node:assert/strict';
import test from 'node:test';
import { getOcrGeminiKeys, OCR_GEMINI_TIMEOUT_MS, runOcrGeminiRotation } from './gemini-rotation.ts';

function scan(keys, firstKey, generate, signal = new AbortController().signal) {
    return runOcrGeminiRotation(keys, firstKey, Date.now() + OCR_GEMINI_TIMEOUT_MS, signal, generate);
}

test('membaca daftar koma di kedua nama env dan menghapus duplikat', () => {
    assert.deepEqual(getOcrGeminiKeys(' a, b, a ,', 'c'), ['a', 'b']);
    assert.deepEqual(getOcrGeminiKeys(' , ', ' a, b, a '), ['a', 'b']);
});

test('enam key dicoba di Flash 3.8 meski lima key lebih dulu terkena kuota', async () => {
    const keys = ['a', 'b', 'c', 'd', 'e', 'f'];
    const attempts = [];
    const result = await scan(keys, 2, async ({ key, model }) => {
        attempts.push([key, model]);
        if (key !== 'b') throw { status: 429 };
        return 'hasil';
    });
    assert.deepEqual(result, { data: 'hasil' });
    assert.deepEqual(attempts.map(([key]) => key), ['c', 'd', 'e', 'f', 'a', 'b']);
    assert.ok(attempts.every(([, model]) => model === 'gemini-3.8-flash'));
});

test('melewati key yang ditolak dan memakai model cadangan setelah daftar model utama', async () => {
    const attempts = [];
    const result = await scan(['invalid', 'limited', 'other'], 0, async ({ key, model }) => {
        attempts.push([key, model]);
        if (key === 'invalid') throw Object.assign(new Error('API_KEY_INVALID'), { status: 400 });
        if (model === 'gemini-3.8-flash') throw { status: key === 'limited' ? 429 : 503 };
        return 'hasil cadangan';
    });
    assert.deepEqual(result, { data: 'hasil cadangan' });
    assert.deepEqual(attempts, [
        ['invalid', 'gemini-3.8-flash'], ['limited', 'gemini-3.8-flash'],
        ['other', 'gemini-3.8-flash'], ['limited', 'gemini-3.6-flash'],
    ]);
});

test('permintaan yang ditolak Gemini dihentikan dan jumlah key yang dicoba akurat', async () => {
    const attempts = [];
    const result = await scan(['a', 'b', 'c'], 0, async ({ key }) => {
        attempts.push(key);
        if (key === 'a') throw { status: 403 };
        throw { status: 400 };
    });
    assert.deepEqual(result, { failure: 'request', triedKeys: 2 });
    assert.deepEqual(attempts, ['a', 'b']);
});

test('respons pertama yang kosong memberi kesempatan key berikutnya membaca foto', async () => {
    const keys = ['a', 'b', 'c'];
    const attempts = [];
    const result = await runOcrGeminiRotation(
        keys, 0, Date.now() + OCR_GEMINI_TIMEOUT_MS, new AbortController().signal,
        async ({ key }) => {
            attempts.push(key);
            return key === 'a' ? [] : ['Soal 4'];
        },
        questions => questions.length === 0,
    );
    assert.deepEqual(result, { data: ['Soal 4'] });
    assert.deepEqual(attempts, ['a', 'b']);
});

test('waktu model utama yang habis menyisakan waktu untuk cadangan', async (t) => {
    let now = Date.now();
    t.mock.method(Date, 'now', () => now);
    const timeouts = [];
    t.mock.method(AbortSignal, 'timeout', (ms) => {
        timeouts.push(ms);
        return new AbortController().signal;
    });
    const attempts = [];
    const result = await scan(['a', 'b'], 0, async ({ key, model }) => {
        attempts.push([key, model]);
        if (model === 'gemini-3.8-flash') {
            now += 18_000;
            throw { status: 504 };
        }
        return 'hasil';
    });
    assert.deepEqual(result, { data: 'hasil' });
    assert.deepEqual(attempts, [
        ['a', 'gemini-3.8-flash'], ['b', 'gemini-3.6-flash'],
    ]);
    assert.deepEqual(timeouts, [14_000, 12_000]);
});

test('permintaan yang dibatalkan berhenti sebelum mencoba key berikutnya', async () => {
    const controller = new AbortController();
    const result = await scan(['a', 'b'], 0, async () => {
        controller.abort();
        throw { status: 429 };
    }, controller.signal);
    assert.deepEqual(result, { failure: 'timeout', triedKeys: 1 });
});
