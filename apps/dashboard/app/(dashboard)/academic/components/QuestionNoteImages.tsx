'use client';

import { useId, useRef, useState, type ReactNode } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { saveQuestionNoteImages } from '../actions';
import { MAX_NOTE_IMAGES } from '../quiz-bank';
import { prepareNoteImage } from '../quiz-ocr-images';

type Change = { added: string[]; removed: string | null };

export default function QuestionNoteImages({ questionId, images = [], onSaved, children }: {
    questionId: string;
    images?: string[];
    onSaved: (images: string[]) => void;
    children: ReactNode;
}) {
    const inputId = useId();
    const input = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);
    const [status, setStatus] = useState('');
    const [error, setError] = useState('');
    const [retry, setRetry] = useState<Change>();

    const save = async (change: Change) => {
        setBusy(true);
        setError('');
        setStatus('Menyimpan gambar…');
        try {
            const result = await saveQuestionNoteImages(questionId, change.added, change.removed);
            if (!result.images) throw new Error(result.error);
            onSaved(result.images);
            setRetry(undefined);
            setStatus(change.removed ? 'Gambar dihapus.' : 'Gambar tersimpan.');
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Gagal menyimpan gambar catatan.');
            setRetry(change);
            setStatus('');
        } finally {
            setBusy(false);
        }
    };

    const addImages = async (files: File[]) => {
        if (busy || !files.length) return;
        if (files.length + images.length > MAX_NOTE_IMAGES) {
            setError(`Maksimal ${MAX_NOTE_IMAGES} gambar per catatan.`);
            return;
        }
        setBusy(true);
        setRetry(undefined);
        setError('');
        setStatus('Menyiapkan gambar…');
        try {
            const added: string[] = [];
            for (const file of files) added.push(await prepareNoteImage(file));
            await save({ added, removed: null });
        } catch {
            setError('Gambar tidak bisa dibuka atau dikompresi. Coba JPG, PNG, atau WebP.');
            setStatus('');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="space-y-2" onPaste={event => {
            const files = Array.from(event.clipboardData.files).filter(file => file.type.startsWith('image/'));
            if (!files.length) return;
            event.preventDefault();
            void addImages(files);
        }}>
            {children}
            <input id={inputId} ref={input} type="file" accept="image/*" multiple hidden onChange={event => {
                const files = Array.from(event.currentTarget.files ?? []);
                event.currentTarget.value = '';
                void addImages(files);
            }} />
            <div className="flex flex-wrap items-center gap-2">
                <button type="button" aria-controls={inputId} onClick={() => input.current?.click()}
                    disabled={busy || images.length >= MAX_NOTE_IMAGES}
                    className="inline-flex items-center gap-1.5 rounded-full bg-surface-container px-3 py-1.5 text-xs font-bold text-on-surface disabled:opacity-50">
                    <ImagePlus className="h-4 w-4" /> Tambah gambar
                </button>
                <span role="status" className={`text-xs ${error ? 'text-red-600' : 'text-secondary'}`}>{error || status}</span>
                {retry && !busy && <button type="button" onClick={() => void save(retry)}
                    className="text-xs font-semibold text-primary underline">Coba lagi</button>}
            </div>
            {images.map((data, index) => (
                <div key={index} className="flex items-start gap-2 rounded-xl border border-surface-variant p-2">
                    <div className="min-w-0 flex-1">
                        {/* eslint-disable-next-line @next/next/no-img-element -- lampiran dikompresi ke WebP di browser */}
                        <img src={`data:image/webp;base64,${data}`} alt={`Gambar catatan ${index + 1}`} loading="lazy" decoding="async"
                            className="h-auto max-w-full rounded-lg" />
                    </div>
                    <button type="button" aria-label={`Hapus gambar catatan ${index + 1}`} disabled={busy}
                        onClick={() => void save({ added: [], removed: data })}
                        className="ml-auto shrink-0 rounded-full bg-surface-container p-1 text-secondary disabled:opacity-50">
                        <X className="h-4 w-4" />
                    </button>
                </div>
            ))}
        </div>
    );
}
