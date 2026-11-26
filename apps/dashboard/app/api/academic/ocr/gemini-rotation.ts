import { setTimeout as delay } from 'node:timers/promises';

const PRIMARY_MODEL = 'gemini-3.8-flash';
const FALLBACK_MODEL = 'gemini-3.6-flash';
const FALLBACK_RESERVE_MS = 12_000;
export const OCR_GEMINI_TIMEOUT_MS = 30_000;

type Failure = 'access' | 'quota' | 'busy' | 'timeout' | 'format' | 'network' | 'request' | 'model';
type Attempt = {
    model: typeof PRIMARY_MODEL | typeof FALLBACK_MODEL;
    key: string;
    signal: AbortSignal;
};

export function getOcrGeminiKeys(list?: string, single?: string): string[] {
    const split = (value?: string) => (value ?? '').split(',').map(key => key.trim()).filter(Boolean);
    const fromList = split(list);
    return Array.from(new Set(fromList.length ? fromList : split(single)));
}

function classifyFailure(error: unknown, timedOut: boolean): { failure: Failure; status: number } {
    const status = typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : 0;
    const message = error instanceof Error ? error.message : '';
    if (timedOut || status === 408 || status === 504 || (
        error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name)
    )) return { failure: 'timeout', status };
    if (status === 401 || status === 403 || (status === 400 && /\bAPI_KEY_(INVALID|EXPIRED|SERVICE_BLOCKED)\b/.test(message))) {
        return { failure: 'access', status };
    }
    if (status === 429) return { failure: 'quota', status };
    if (status >= 500) return { failure: 'busy', status };
    if (status === 404) return { failure: 'model', status };
    if (error instanceof SyntaxError) return { failure: 'format', status };
    return { failure: status ? 'request' : 'network', status };
}

export async function runOcrGeminiRotation<T>(
    keys: string[], firstKey: number, deadline: number, requestSignal: AbortSignal, generate: (attempt: Attempt) => Promise<T>,
    isEmpty?: (data: T) => boolean,
): Promise<{ data: T } | { failure: Failure; triedKeys: number }> {
    let failure: Failure = 'timeout';
    let useFallback = false;
    let nextKey = firstKey;
    const tried = new Set<number>();
    const rejected = new Set<number>();
    let emptyResult: { data: T } | undefined;

    for (const model of [PRIMARY_MODEL, FALLBACK_MODEL] as const) {
        const isPrimary = model === PRIMARY_MODEL;
        if (!isPrimary && !useFallback) break;
        let unavailableCount = 0;
        const modelDeadline = isPrimary ? deadline - FALLBACK_RESERVE_MS : deadline;
        const start = nextKey;

        for (let offset = 0; offset < keys.length; offset++) {
            const remaining = modelDeadline - Date.now();
            if (requestSignal.aborted || remaining <= 0) break;
            const index = (start + offset) % keys.length;
            if (rejected.has(index)) continue;
            nextKey = (index + 1) % keys.length;

            const timeout = Math.min(remaining, isPrimary ? 14_000 : 25_000);
            const signal = AbortSignal.any([requestSignal, AbortSignal.timeout(timeout)]);
            tried.add(index);
            try {
                const data = await generate({ model, key: keys[index], signal });
                if (!isEmpty?.(data) || emptyResult) return { data };
                emptyResult = { data };
                useFallback = true;
            } catch (error) {
                const result = classifyFailure(error, signal.aborted);
                failure = result.failure;
                console.warn('Academic OCR Gemini attempt failed', {
                    model, keyIndex: index + 1, totalKeys: keys.length, status: result.status, failure,
                });
                if (failure === 'request') return { failure, triedKeys: tried.size };
                if (failure === 'access') rejected.add(index);
                else useFallback = true;
                if (isPrimary && result.status === 503 && ++unavailableCount >= 2) break;
                if (failure === 'busy') {
                    const wait = Math.min(250, modelDeadline - Date.now());
                    if (wait > 0) await delay(wait, undefined, { signal: requestSignal }).catch(() => undefined);
                }
            }
        }
    }

    return emptyResult ?? { failure, triedKeys: tried.size };
}
