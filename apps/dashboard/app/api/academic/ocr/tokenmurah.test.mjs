import assert from 'node:assert/strict';
import test from 'node:test';
import { requestTokenMurahOcr } from './tokenmurah.ts';

const settings = { apiKey: 'sk-tm-example_test_only', model: 'gpt-5.4-mini' };
const scan = (mimeType = 'image/jpeg', signal = new AbortController().signal) =>
    requestTokenMurahOcr(settings, 'AAAA', mimeType, 'Kembalikan JSON.', signal);

test('mengirim satu request berisi gambar dan Bearer key ke TokenMurah', async (t) => {
    const controller = new AbortController();
    const fetch = t.mock.method(globalThis, 'fetch', async (url, request) => {
        assert.equal(url, 'https://tokenmurah.net/v1/chat/completions');
        assert.equal(request.headers.Authorization, `Bearer ${settings.apiKey}`);
        assert.equal(request.redirect, 'error');
        assert.equal(request.signal, controller.signal);
        const body = JSON.parse(request.body);
        assert.equal(body.model, settings.model);
        assert.deepEqual(body.messages[0].content[1], {
            type: 'image_url', image_url: { url: 'data:image/jpeg;base64,AAAA', detail: 'high' },
        });
        assert.equal(JSON.stringify(body).includes(settings.apiKey), false);
        return Response.json({ choices: [{ message: { content: '{"4":"A"}' } }] });
    });
    assert.deepEqual(await scan('image/jpeg', controller.signal), { text: '{"4":"A"}' });
    assert.equal(fetch.mock.callCount(), 1);
});

test('membedakan saldo, model yang tidak tersedia, dan format foto', async (t) => {
    const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json({}, { status: 402 }));
    assert.equal((await scan()).status, 402);
    assert.equal(fetch.mock.callCount(), 1);
    fetch.mock.mockImplementation(async () => Response.json({ error: { code: 'model_not_found' } }, { status: 400 }));
    assert.match((await scan()).error, /Model tidak tersedia/);
    assert.equal((await scan('image/heif')).status, 400);
    assert.equal(fetch.mock.callCount(), 2);
});

test('menolak hasil terpotong dan melaporkan timeout tanpa request ulang', async (t) => {
    const fetch = t.mock.method(globalThis, 'fetch', async () =>
        Response.json({ choices: [{ finish_reason: 'length', message: { content: '{"questions": [' } }] }));
    assert.match((await scan()).error, /terpotong/);
    const controller = new AbortController();
    fetch.mock.mockImplementation(async () => {
        controller.abort();
        throw controller.signal.reason;
    });
    assert.equal((await scan('image/jpeg', controller.signal)).status, 504);
    assert.equal(fetch.mock.callCount(), 2);
});
