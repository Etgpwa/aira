'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { saveQuestionNote } from '../actions';
import QuestionNoteImages from '../components/QuestionNoteImages';

type Status = 'idle' | 'waiting' | 'saving' | 'saved' | 'error';

export default function QuestionNote({ questionId, note, images: initialImages }: { questionId: string; note: string; images?: string[] }) {
    const editorId = useId();
    const [open, setOpen] = useState(false);
    const [text, setText] = useState(note);
    const [images, setImages] = useState(initialImages ?? []);
    const [status, setStatus] = useState<Status>('idle');
    const latest = useRef(note);
    const persisted = useRef(note.trim());
    const saving = useRef(false);
    const mounted = useRef(false);
    const timer = useRef<ReturnType<typeof setTimeout>>();

    const flush = useCallback(async () => {
        clearTimeout(timer.current);
        if (saving.current || latest.current.trim() === persisted.current) return;

        saving.current = true;
        if (mounted.current) setStatus('saving');
        try {
            // Kirim berurutan agar jawaban dari request lama tidak menimpa suntingan terbaru.
            while (latest.current.trim() !== persisted.current) {
                const snapshot = latest.current.trim();
                await saveQuestionNote(questionId, snapshot);
                persisted.current = snapshot;
            }
            if (mounted.current) setStatus('saved');
        } catch {
            if (mounted.current) setStatus('error');
        } finally {
            saving.current = false;
        }
    }, [questionId]);

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
            void flush();
        };
    }, [flush]);

    const message = {
        idle: '',
        waiting: 'Menunggu simpan…',
        saving: 'Menyimpan…',
        saved: 'Tersimpan',
        error: 'Gagal menyimpan',
    }[status];

    return (
        <div className="border-t border-surface-variant pt-3">
            <div className="flex flex-wrap items-center gap-2">
                <button type="button" aria-expanded={open} aria-controls={editorId} onClick={() => {
                    if (open) void flush();
                    setOpen(!open);
                }} className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-2 text-xs font-bold text-primary">
                    <MessageSquare className="h-4 w-4" />
                    {open ? 'Tutup catatan' : text.trim() || images.length ? 'Lihat catatan' : 'Tulis catatan'}
                </button>
                <span role="status" className={`text-xs ${status === 'error' ? 'text-red-600' : 'text-secondary'}`}>{message}</span>
                {status === 'error' && (
                    <button type="button" onClick={() => void flush()} className="text-xs font-semibold text-primary underline">
                        Coba lagi
                    </button>
                )}
            </div>
            <div id={editorId} hidden={!open} className="mt-2">
                <QuestionNoteImages questionId={questionId} images={images} onSaved={setImages}>
                    <label htmlFor={`${editorId}-text`} className="sr-only">Catatan penjelasan jawaban</label>
                    <textarea
                        id={`${editorId}-text`}
                        rows={3}
                        value={text}
                        placeholder="Tulis alasan jawaban benar atau cara mengerjakannya…"
                        onChange={event => {
                            const value = event.target.value;
                            latest.current = value;
                            setText(value);
                            clearTimeout(timer.current);
                            if (!saving.current && value.trim() === persisted.current) {
                                setStatus('saved');
                                return;
                            }
                            if (!saving.current) setStatus('waiting');
                            timer.current = setTimeout(() => void flush(), 650);
                        }}
                        onBlur={() => void flush()}
                        className="w-full resize-y rounded-xl border border-surface-variant bg-surface p-3 text-sm text-on-surface"
                    />
                </QuestionNoteImages>
            </div>
        </div>
    );
}
