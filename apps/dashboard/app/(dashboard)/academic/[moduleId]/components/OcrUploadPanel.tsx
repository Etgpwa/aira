'use client';

import { useEffect, useMemo, useState, useTransition, useRef } from 'react';
import { Camera, Key, Plus, Loader2, Check, X, ChevronDown, ChevronUp, FolderOpen, Image as ImageIcon } from 'lucide-react';
import { applyKunciToModule, saveQuestions } from '../../actions';
import ManualQuizInput from '../../components/ManualQuizInput';
import { useRouter } from 'next/navigation';
import QuizImages from '../../components/QuizImages';
import {
    MAX_OCR_PHOTO_BASE64, MAX_PERSONAL_KEY_INPUT, OCR_CLIENT_TIMEOUT_MS, QUIZ_FIELDS,
    resolveOcrQuestions, sortQuestionsBySourceNumber, fingerprintOcrPhoto, mergeOcrStrips, readPersonalGeminiKeys,
    readTokenMurahOcrSettings, TOKENMURAH_OCR_DEFAULT_MODEL, type TokenMurahOcrSettings,
    type AcademicOcrResults, type ImageRegion, type OcrPage, type OcrPassage, type OcrQuestion, type OcrSolution, type OcrStrip,
} from '../../quiz-ocr';
import { cropQuizImages, prepareOcrFile } from '../../quiz-ocr-images';

type OcrCredentials = { personalGeminiKeys?: string; tokenMurah?: TokenMurahOcrSettings };

async function requestAcademicOcr<Kind extends keyof AcademicOcrResults>(
    kind: Kind, base64: string, mimeType: string, credentials: OcrCredentials, subjectName?: string,
): Promise<AcademicOcrResults[Kind]> {
    if (base64.length > MAX_OCR_PHOTO_BASE64) {
        throw new Error('File foto terlalu besar. Pilih versi berukuran lebih kecil.');
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), OCR_CLIENT_TIMEOUT_MS);
    const timeoutMessage = credentials.tokenMurah
        ? 'Server OCR terlalu lama merespons. Periksa Log request TokenMurah sebelum mencoba lagi.'
        : 'Server OCR terlalu lama merespons. Ulangi scan foto ini.';
    try {
        const response = await fetch('/api/academic/ocr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ kind, base64, mimeType, subjectName, ...credentials }),
            signal: controller.signal,
        }).catch(() => {
            throw new Error(controller.signal.aborted ? timeoutMessage : 'Koneksi ke server OCR gagal. Coba lagi.');
        });
        const result: { data?: AcademicOcrResults[Kind]; error?: string } | null = await response.json().catch(() => null);
        if (controller.signal.aborted || (response.status === 504 && !result?.error)) throw new Error(timeoutMessage);
        if (!response.ok || !result?.data) {
            throw new Error(result?.error || 'Server OCR tidak bisa memproses permintaan. Coba lagi.');
        }
        return result.data;
    } finally {
        clearTimeout(timer);
    }
}

interface OcrUploadPanelProps {
    moduleId: string;
    subjectName: string;
    userId: string;
}

export default function OcrUploadPanel({ moduleId, subjectName, userId }: OcrUploadPanelProps) {
    const [activePanel, setActivePanel] = useState<'none' | 'soal' | 'kunci' | 'manual'>('none');
    const [activePickerModal, setActivePickerModal] = useState<'soal' | 'kunci' | null>(null);
    const [isPending, startTransition] = useTransition();
    const [previewQuestions, setPreviewQuestions] = useState<OcrQuestion[]>([]);
    const [passages, setPassages] = useState<OcrPassage[]>([]);
    const [solutions, setSolutions] = useState<OcrSolution[]>([]);
    const [excludedIndices, setExcludedIndices] = useState<number[]>([]);
    const [isWorking, setIsWorking] = useState(false);
    const isBusy = isWorking || isPending;
    const resolved = useMemo(() => resolveOcrQuestions(previewQuestions, passages, solutions), [previewQuestions, passages, solutions]);
    const included = sortQuestionsBySourceNumber(previewQuestions.map((question, index) => ({
        question, index, source_number: question.source_number,
    })).filter(({ index }) => !excludedIndices.includes(index)));
    const unmatchedSolutionNumbers = Array.from(new Set(solutions.map(solution => solution.source_number)))
        .filter(number => !previewQuestions.some(question => question.source_number === number));
    const [kunciResult, setKunciResult] = useState<Record<number, string> | null>(null);
    const [status, setStatus] = useState<string>('');
    const [personalKeys, setPersonalKeys] = useState<string>();
    const [tokenMurah, setTokenMurah] = useState<TokenMurahOcrSettings>();
    const [providerDraft, setProviderDraft] = useState<'gemini' | 'tokenmurah'>('gemini');
    const [modelDraft, setModelDraft] = useState(TOKENMURAH_OCR_DEFAULT_MODEL);
    const [keyDraft, setKeyDraft] = useState('');
    const [keyError, setKeyError] = useState('');
    const keyStorage = `academic-ocr-gemini:${userId}`;
    const tokenMurahStorage = `academic-ocr-tokenmurah:${userId}`;
    const credentials: OcrCredentials = tokenMurah ? { tokenMurah } : { personalGeminiKeys: personalKeys };
    const router = useRouter();

    useEffect(() => {
        try {
            const stored = readPersonalGeminiKeys(sessionStorage.getItem(keyStorage));
            setPersonalKeys(stored?.join(','));
        } catch {
            setPersonalKeys(undefined);
        }
        try {
            const stored = readTokenMurahOcrSettings(JSON.parse(sessionStorage.getItem(tokenMurahStorage) ?? 'null'));
            setTokenMurah(stored ?? undefined);
            setModelDraft(stored?.model ?? TOKENMURAH_OCR_DEFAULT_MODEL);
            setProviderDraft(stored ? 'tokenmurah' : 'gemini');
        } catch {
            setTokenMurah(undefined);
            setModelDraft(TOKENMURAH_OCR_DEFAULT_MODEL);
            setProviderDraft('gemini');
        }
    }, [keyStorage, tokenMurahStorage]);

    const selectGeminiKeys = (keys?: string) => {
        setPersonalKeys(keys);
        setTokenMurah(undefined);
        setProviderDraft('gemini');
        setKeyDraft('');
        setKeyError('');
        try {
            sessionStorage.removeItem(tokenMurahStorage);
            if (keys) sessionStorage.setItem(keyStorage, keys);
            else sessionStorage.removeItem(keyStorage);
        } catch {
            // Pilihan masih dapat dipakai di halaman ini jika browser memblokir sessionStorage.
        }
    };

    const selectTokenMurah = (settings: TokenMurahOcrSettings) => {
        setTokenMurah(settings);
        setModelDraft(settings.model);
        setKeyDraft('');
        setKeyError('');
        try {
            sessionStorage.setItem(tokenMurahStorage, JSON.stringify(settings));
        } catch {
            // Pilihan masih berlaku di halaman ini.
        }
    };

    const processedQuestionPhotos = useRef(new Set<string>());
    const cameraSoalInputRef = useRef<HTMLInputElement>(null);
    const folderSoalInputRef = useRef<HTMLInputElement>(null);
    const cameraKunciInputRef = useRef<HTMLInputElement>(null);
    const folderKunciInputRef = useRef<HTMLInputElement>(null);

    const handleScanSoal = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        e.target.value = '';
        if (!files.length || isBusy) return;
        setIsWorking(true);
        let skippedPhotos = 0;
        const allExtracted: OcrQuestion[] = [];
        const allPassages: OcrPassage[] = [];
        const allSolutions: OcrSolution[] = [];
        const failures: string[] = [];
        try {
            for (let index = 0; index < files.length; index++) {
                try {
                    setStatus(`Menyiapkan foto ${index + 1} dari ${files.length}…`);
                    const fingerprint = await fingerprintOcrPhoto(files[index]).catch(() => null);
                    if (fingerprint && processedQuestionPhotos.current.has(fingerprint)) {
                        skippedPhotos++;
                        continue;
                    }
                    const { photo, strips, encode } = await prepareOcrFile(files[index], true);
                    const scans: { page: OcrPage; strip: OcrStrip | null }[] = [];
                    for (let part = 0; part < strips.length; part++) {
                        const strip = strips[part];
                        const label = strips.length > 1 ? `foto ${index + 1}, bagian ${part + 1} dari ${strips.length}` : `foto ${index + 1} dari ${files.length}`;
                        setStatus(`Menganalisis ${label}…`);
                        try {
                            const { base64, mimeType } = encode(strip);
                            const page = await requestAcademicOcr('questions', base64, mimeType, credentials, subjectName);
                            scans.push({ page, strip });
                        } catch (error) {
                            failures.push(`${label}. ${error instanceof Error ? error.message : 'Ulangi scan bagian ini.'}`);
                        }
                    }
                    if (!scans.length) continue;
                    const page = mergeOcrStrips(scans, photo?.naturalHeight ?? 1);
                    setStatus(`Menyiapkan pratinjau foto ${index + 1} dari ${files.length}…`);
                    const extractImages = (regions: ImageRegion[]) => {
                        try {
                            if (photo && regions.length) return cropQuizImages(photo, regions);
                        } catch (error) {
                            console.error('Gagal memotong gambar Academic:', error);
                        }
                        return { ocr_images: [], failed_crops: regions.length };
                    };
                    allExtracted.push(...page.questions.map(({ regions, ...question }) => ({
                        ...question, ...extractImages(regions),
                    })));
                    allPassages.push(...page.passages.map(({ regions, ...passage }) => ({
                        ...passage, ...extractImages(regions),
                    })));
                    allSolutions.push(...page.solutions.map(({ regions, ...solution }) => ({
                        ...solution, ...extractImages(regions),
                    })));
                    if (fingerprint && (page.questions.length || page.passages.length || page.solutions.length)) {
                        processedQuestionPhotos.current.add(fingerprint);
                    }
                } catch (error) {
                    failures.push(`Foto ${index + 1}. ${error instanceof Error ? error.message : 'Ulangi scan foto ini.'}`);
                    console.error(`Gagal scan foto ke-${index + 1}:`, error);
                }
            }

            const warning = (failures.length ? ` ${failures.length} bagian gagal. ${failures[0]}` : '')
                + (failures.length && allExtracted.length ? ' Pindai ulang bagian yang gagal sebagai foto terpisah.' : '')
                + (skippedPhotos ? ` ${skippedPhotos} foto sudah dipindai; tidak mengirim request ulang.` : '');
            if (allExtracted.length || allPassages.length || allSolutions.length) {
                setPreviewQuestions(prev => [...prev, ...allExtracted]);
                setPassages(prev => [...prev, ...allPassages]);
                setSolutions(prev => [...prev, ...allSolutions]);
                setStatus(allExtracted.length
                    ? `Ditemukan ${allExtracted.length} soal. Periksa konteks dan gambar sebelum menyimpan.${warning}`
                    : `Bacaan atau solusi sudah ditambahkan. Pastikan halaman yang berisi soalnya ikut dipindai.${warning}`);
            } else {
                setStatus(failures.length ? `Gagal memproses scan.${warning}` : skippedPhotos ? warning.trim() : 'Tidak ada soal yang terdeteksi pada gambar.');
            }
        } finally {
            setIsWorking(false);
        }
    };

    const handleScanKunci = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        e.target.value = '';
        if (!files.length || isBusy) return;
        setIsWorking(true);
        const mergedKunci: Record<number, string> = {};
        const failures: string[] = [];
        try {
            for (let index = 0; index < files.length; index++) {
                try {
                    setStatus(`Menyiapkan foto kunci ${index + 1} dari ${files.length}…`);
                    const { encode } = await prepareOcrFile(files[index]);
                    const { base64, mimeType } = encode(null);
                    setStatus(`Membaca kunci jawaban foto ${index + 1} dari ${files.length}…`);
                    Object.assign(mergedKunci, await requestAcademicOcr('answer_key', base64, mimeType, credentials));
                } catch (error) {
                    failures.push(`Foto ${index + 1}. ${error instanceof Error ? error.message : 'Ulangi scan foto ini.'}`);
                    console.error(`Gagal scan kunci foto ke-${index + 1}:`, error);
                }
            }

            const count = Object.keys(mergedKunci).length;
            const warning = failures.length ? ` ${failures.length} foto gagal. ${failures[0]}` : '';
            if (count) {
                setKunciResult(prev => ({ ...(prev || {}), ...mergedKunci }));
                setStatus(`Terdeteksi ${count} kunci jawaban. Konfirmasi untuk menerapkan.${warning}`);
            } else {
                setStatus(failures.length ? `Gagal memproses scan kunci.${warning}` : 'Kunci jawaban tidak terdeteksi pada gambar.');
            }
        } finally {
            setIsWorking(false);
        }
    };

    const handleApplyKunci = () => {
        if (!kunciResult) return;
        startTransition(async () => {
            const result = await applyKunciToModule(moduleId, kunciResult);
            if (result?.error) {
                setStatus(result.error);
                return;
            }
            setKunciResult(null);
            setStatus('Kunci jawaban berhasil diterapkan!');
            router.refresh();
        });
    };

    const resetPreview = () => {
        processedQuestionPhotos.current.clear();
        setPreviewQuestions([]);
        setPassages([]);
        setSolutions([]);
        setExcludedIndices([]);
        setStatus('');
    };

    const handleSavePreview = async () => {
        if (!included.length || isBusy) return;
        const drafts = included.map(({ question, index }) => {
            const { context, images } = resolved[index];
            return {
                id: question.draft_id,
                source_number: question.source_number,
                question_text: [context, question.question_text].filter(Boolean).join('\n\n'),
                question_type: question.question_type,
                option_a: question.option_a,
                option_b: question.option_b,
                option_c: question.option_c,
                option_d: question.option_d,
                correct_answer: question.correct_answer,
                subject_name: question.subject_name,
                ocr_images: images,
            };
        });
        const requestLimit = 3_500_000;
        const sizes = drafts.map(draft => new Blob([JSON.stringify(draft)]).size + 1);
        if (sizes.some(size => size > requestLimit)) {
            setStatus('Gagal menyimpan karena satu soal memuat terlalu banyak gambar. Keluarkan soal itu dari daftar simpan.');
            return;
        }
        setIsWorking(true);
        let saved = 0;
        try {
            while (saved < drafts.length) {
                let end = saved;
                let size = 0;
                while (end < drafts.length && size + sizes[end] <= requestLimit) size += sizes[end++];
                setStatus(`Menyimpan soal ${saved + 1}–${end} dari ${drafts.length}…`);
                const result = await saveQuestions(drafts.slice(saved, end), moduleId);
                if (result.error) {
                    setStatus(`${result.error}${saved ? ` ${saved} soal sudah tersimpan.` : ''}`);
                    return;
                }
                const savedIndices = included.slice(saved, end).map(({ index }) => index);
                setExcludedIndices(prev => [...prev, ...savedIndices]);
                saved = end;
            }
            resetPreview();
            setStatus('Soal berhasil disimpan.');
        } catch (error) {
            console.error('Gagal menyimpan hasil OCR:', error);
            setStatus(`Gagal menyimpan soal. ${saved ? `${saved} soal sudah tersimpan. ` : ''}Coba lagi.`);
        } finally {
            if (saved) router.refresh();
            setIsWorking(false);
        }
    };

    const updatePreviewQ = (idx: number, field: string, value: string) => {
        const updated = [...previewQuestions];
        updated[idx] = { ...updated[idx], [field]: value };
        setPreviewQuestions(updated);
    };

    const removePreviewQ = (idx: number) => {
        setExcludedIndices(prev => [...prev, idx]);
    };

    return (
        <div className="flex flex-col gap-3">
            {/* Hidden Input Files */}
            {/* Soal: Kamera Langsung */}
            <input
                ref={cameraSoalInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleScanSoal}
            />
            {/* Soal: Buka Folder / Galeri (Bisa Pilih Banyak Foto) */}
            <input
                ref={folderSoalInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleScanSoal}
            />

            {/* Kunci: Kamera Langsung */}
            <input
                ref={cameraKunciInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleScanKunci}
            />
            {/* Kunci: Buka Folder / Galeri (Bisa Pilih Banyak Foto) */}
            <input
                ref={folderKunciInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleScanKunci}
            />

            {/* Action Buttons Row */}
            <div className="grid grid-cols-3 gap-2">
                {/* Scan Soal Button */}
                <button
                    disabled={isBusy}
                    onClick={() => setActivePickerModal('soal')}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-[14px] border-2 transition-all active:scale-95 ${activePickerModal === 'soal' ? 'border-primary bg-primary/10' : 'border-surface-variant bg-surface-bright'}`}
                >
                    <Camera className="w-5 h-5 text-primary" />
                    <span className="text-[11px] font-bold text-on-surface text-center leading-tight">Scan Soal</span>
                </button>

                {/* Scan Kunci Button */}
                <button
                    disabled={isBusy}
                    onClick={() => setActivePickerModal('kunci')}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-[14px] border-2 transition-all active:scale-95 ${activePickerModal === 'kunci' ? 'border-amber-400 bg-amber-50' : 'border-surface-variant bg-surface-bright'}`}
                >
                    <Key className="w-5 h-5 text-amber-500" />
                    <span className="text-[11px] font-bold text-on-surface text-center leading-tight">Scan Kunci</span>
                </button>

                {/* Input Manual */}
                <button
                    onClick={() => setActivePanel(prev => prev === 'manual' ? 'none' : 'manual')}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-[14px] border-2 transition-all active:scale-95 ${activePanel === 'manual' ? 'border-mint-fg bg-mint-bg/20' : 'border-surface-variant bg-surface-bright'}`}
                >
                    <Plus className="w-5 h-5 text-mint-fg" />
                    <span className="text-[11px] font-bold text-on-surface text-center leading-tight">Manual</span>
                </button>
            </div>

            <details className="rounded-[14px] border border-surface-variant bg-surface-bright px-3 py-2.5">
                <summary className="cursor-pointer text-sm font-semibold text-on-surface">
                    API OCR <span className="ml-1 break-words text-xs font-normal text-secondary">
                        {tokenMurah ? `TokenMurah · ${tokenMurah.model}`
                            : personalKeys ? `Gemini · ${personalKeys.split(',').length} key pribadi aktif` : 'Gemini · Key dashboard'}
                    </span>
                </summary>
                <div className="mt-3 flex gap-2" role="group" aria-label="Penyedia API OCR">
                    {(['gemini', 'tokenmurah'] as const).map(provider => (
                        <button key={provider} type="button" disabled={isBusy} aria-pressed={providerDraft === provider}
                            onClick={() => {
                                setProviderDraft(provider);
                                setKeyDraft('');
                                setKeyError('');
                            }}
                            className={`rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-50 ${providerDraft === provider
                                ? 'border-primary bg-primary/10 text-primary' : 'border-surface-variant text-on-surface'}`}>
                            {provider === 'gemini' ? 'Gemini' : 'TokenMurah'}
                        </button>
                    ))}
                </div>
                <form
                    className="mt-3 grid gap-2"
                    onSubmit={event => {
                        event.preventDefault();
                        if (isBusy) return;
                        if (providerDraft === 'tokenmurah') {
                            const settings = readTokenMurahOcrSettings({ apiKey: keyDraft.trim() || tokenMurah?.apiKey, model: modelDraft });
                            if (!settings) {
                                setKeyError('Isi API key TokenMurah yang utuh dan ID model dari katalog.');
                                return;
                            }
                            selectTokenMurah(settings);
                            return;
                        }
                        const keys = readPersonalGeminiKeys(keyDraft);
                        if (!keys) {
                            setKeyError('Tempel API key lengkap dari Google AI Studio, tanpa tanda kutip. Pisahkan beberapa key dengan koma.');
                            return;
                        }
                        selectGeminiKeys(keys.join(','));
                    }}
                >
                    <label className="text-xs font-semibold text-on-surface" htmlFor="academic-ocr-key">
                        {providerDraft === 'tokenmurah' ? 'API key TokenMurah' : 'API key Gemini pribadi'}
                    </label>
                    <input
                        id="academic-ocr-key"
                        type="password"
                        value={keyDraft}
                        placeholder={providerDraft === 'tokenmurah' ? (tokenMurah ? 'Key sudah aktif di tab ini' : 'sk-tm-…') : undefined}
                        maxLength={MAX_PERSONAL_KEY_INPUT}
                        autoComplete="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        disabled={isBusy}
                        onChange={event => {
                            setKeyDraft(event.target.value);
                            setKeyError('');
                        }}
                        className="min-w-0 rounded-lg border border-surface-variant bg-surface px-3 py-2 text-sm text-on-surface"
                        aria-describedby="academic-ocr-key-help"
                        aria-invalid={Boolean(keyError)}
                    />
                    {providerDraft === 'tokenmurah' && (
                        <label className="grid gap-1 text-xs font-semibold text-on-surface">
                            ID model yang menerima gambar
                            <input type="text" value={modelDraft} maxLength={128} spellCheck={false}
                                autoCapitalize="none" disabled={isBusy}
                                onChange={event => { setModelDraft(event.target.value); setKeyError(''); }}
                                className="min-w-0 rounded-lg border border-surface-variant bg-surface px-3 py-2 text-sm font-normal text-on-surface" />
                        </label>
                    )}
                    <p id="academic-ocr-key-help" className="text-xs text-secondary">
                        {providerDraft === 'tokenmurah' ? (
                            <>Scan memakai saldo atau kuota TokenMurah di tab ini.{' '}
                                <a href="https://tokenmurah.net/dashboard/api-keys" target="_blank" rel="noreferrer" className="font-semibold text-primary underline">Kelola key TokenMurah</a>
                            </>
                        ) : (
                            <>Pisahkan beberapa key dengan koma. Key aktif untuk Scan Soal dan Scan Kunci di tab ini.{' '}
                                <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="font-semibold text-primary underline">Ambil key di Google AI Studio</a>
                            </>
                        )}
                    </p>
                    {keyError && <p role="alert" className="text-xs font-medium text-red-600">{keyError}</p>}
                    <div className="flex flex-wrap gap-2">
                        <button type="submit" disabled={isBusy} className="rounded-full bg-primary px-3 py-2 text-xs font-bold text-on-primary disabled:opacity-50">
                            {providerDraft === 'tokenmurah' ? 'Pakai TokenMurah' : 'Pakai key pribadi'}
                        </button>
                        {tokenMurah ? (
                            <button type="button" onClick={() => selectGeminiKeys(personalKeys)} disabled={isBusy} className="rounded-full bg-surface-container px-3 py-2 text-xs font-bold text-on-surface disabled:opacity-50">
                                Kembali ke Gemini
                            </button>
                        ) : providerDraft === 'gemini' && personalKeys && (
                            <button type="button" onClick={() => selectGeminiKeys()} disabled={isBusy} className="rounded-full bg-surface-container px-3 py-2 text-xs font-bold text-on-surface disabled:opacity-50">
                                Kembali ke key dashboard
                            </button>
                        )}
                    </div>
                </form>
            </details>

            {/* Modal Pilih Sumber Gambar (Kamera vs Folder/Galeri) */}
            {activePickerModal && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-surface-bright border border-surface-variant rounded-[24px] p-5 w-full max-w-sm shadow-2xl flex flex-col gap-4">
                        <div className="flex items-center justify-between pb-2 border-b border-surface-variant">
                            <div className="flex items-center gap-2">
                                {activePickerModal === 'soal' ? (
                                    <Camera className="w-5 h-5 text-primary" />
                                ) : (
                                    <Key className="w-5 h-5 text-amber-500" />
                                )}
                                <h3 className="text-base font-bold text-on-surface">
                                    {activePickerModal === 'soal' ? 'Pilih Sumber Soal' : 'Pilih Sumber Kunci'}
                                </h3>
                            </div>
                            <button
                                onClick={() => setActivePickerModal(null)}
                                className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-secondary hover:text-on-surface"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <p className="text-xs text-secondary leading-relaxed">
                            {activePickerModal === 'soal'
                                ? 'Pilih foto halaman soal. Jika ada rujukan, scan juga halaman sumbernya sebelum menyimpan.'
                                : 'Ambil foto lembar kunci jawaban atau pilih gambar screenshot dari galeri.'}
                        </p>
                        <div className="grid grid-cols-1 gap-2.5">
                            {/* Opsi 1: Kamera Langsung */}
                            <button
                                onClick={() => {
                                    const modalType = activePickerModal;
                                    setActivePickerModal(null);
                                    if (modalType === 'soal') {
                                        cameraSoalInputRef.current?.click();
                                    } else {
                                        cameraKunciInputRef.current?.click();
                                    }
                                }}
                                className="flex items-center gap-3.5 p-3.5 rounded-[16px] bg-primary/10 hover:bg-primary/15 border border-primary/30 text-primary font-bold text-sm transition-all active:scale-[0.98]"
                            >
                                <div className="w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center flex-shrink-0">
                                    <Camera className="w-5 h-5" />
                                </div>
                                <div className="text-left">
                                    <div className="text-sm font-bold text-on-surface">Ambil Foto (Kamera)</div>
                                    <div className="text-xs text-secondary font-normal">Buka kamera belakang langsung</div>
                                </div>
                            </button>

                            {/* Opsi 2: Buka Folder / Galeri */}
                            <button
                                onClick={() => {
                                    const modalType = activePickerModal;
                                    setActivePickerModal(null);
                                    if (modalType === 'soal') {
                                        folderSoalInputRef.current?.click();
                                    } else {
                                        folderKunciInputRef.current?.click();
                                    }
                                }}
                                className="flex items-center gap-3.5 p-3.5 rounded-[16px] bg-surface-container hover:bg-surface-variant/40 border border-surface-variant text-on-surface font-bold text-sm transition-all active:scale-[0.98]"
                            >
                                <div className="w-10 h-10 rounded-full bg-surface-variant text-primary flex items-center justify-center flex-shrink-0">
                                    <FolderOpen className="w-5 h-5" />
                                </div>
                                <div className="text-left">
                                    <div className="text-sm font-bold text-on-surface">Buka Galeri / Folder (Bisa Pilih Banyak Foto)</div>
                                    <div className="text-xs text-secondary font-normal">Pilih satu atau beberapa file foto / screenshot sekaligus</div>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Status message */}
            {(isBusy || status) && (
                <div role="status" className={`rounded-[12px] px-4 py-2.5 text-sm font-medium flex items-center gap-2 ${isBusy ? 'bg-primary/10 text-primary' : status.includes('Gagal') ? 'bg-red-50 text-red-600' : 'bg-mint-bg/20 text-mint-fg'}`}>
                    {isBusy ? <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" /> : <Check className="w-4 h-4 flex-shrink-0" />}
                    {status || 'Memproses…'}
                </div>
            )}

            {/* Kunci Jawaban Preview */}
            {kunciResult && Object.keys(kunciResult).length > 0 && !isBusy && (
                <div className="bg-amber-50 border border-amber-200 rounded-[16px] p-4">
                    <p className="font-bold text-amber-700 mb-2">Preview Kunci Jawaban</p>
                    <div className="grid grid-cols-5 gap-1.5 mb-4">
                        {Object.entries(kunciResult).map(([num, ans]) => (
                            <div key={num} className="bg-white border border-amber-200 rounded-lg p-1.5 text-center">
                                <p className="text-[10px] text-amber-500 font-bold">No. {num}</p>
                                <p className="text-sm font-extrabold text-amber-700">{ans}</p>
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setKunciResult(null)} className="flex-1 bg-surface-container text-secondary py-2 rounded-full text-sm font-bold">Batal</button>
                        <button onClick={handleApplyKunci} disabled={isPending} className="flex-1 bg-amber-500 text-white py-2 rounded-full text-sm font-bold">Terapkan</button>
                    </div>
                </div>
            )}

            {/* Preview OCR Soal */}
            {(previewQuestions.length > 0 || passages.length > 0 || solutions.length > 0) && !isBusy && (
                <div className="bg-surface-bright border border-surface-variant rounded-[16px] p-4">
                    <div className="flex justify-between items-center mb-3">
                        <p className="font-bold text-on-surface">Preview {included.length} Soal</p>
                        <span className="text-xs text-secondary">Periksa & edit sebelum simpan</span>
                    </div>
                    {unmatchedSolutionNumbers.length > 0 && (
                        <p className="mb-2 text-xs font-medium text-amber-700">
                            Scan soal asli nomor {unmatchedSolutionNumbers.join(', ')} agar gambar solusinya bisa dipasangkan.
                        </p>
                    )}
                    <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto">
                        {included.map(({ question, index }) => (
                            <PreviewQuestionCard
                                key={index}
                                question={question}
                                resolved={resolved[index]}
                                index={index}
                                onChange={(field, val) => updatePreviewQ(index, field, val)}
                                onRemove={() => removePreviewQ(index)}
                            />
                        ))}
                    </div>
                    <div className="flex gap-2 mt-4">
                        <button onClick={resetPreview} className="flex-1 bg-surface-container text-secondary py-2.5 rounded-full font-bold text-sm">Batal</button>
                        <button onClick={handleSavePreview} disabled={!included.length} className="flex-1 bg-primary text-on-primary py-2.5 rounded-full font-bold text-sm flex items-center justify-center gap-1.5 disabled:opacity-50">
                            <Check className="w-4 h-4" /> Simpan Semua
                        </button>
                    </div>
                </div>
            )}

            {/* Manual Input Form */}
            {activePanel === 'manual' && (
                <ManualQuizInput userId="" moduleId={moduleId} subjectName={subjectName} onClose={() => setActivePanel('none')} />
            )}
        </div>
    );
}

// ─── Sub-komponen: Preview card per soal ────────────────────────
function PreviewQuestionCard({ question, resolved, index, onChange, onRemove }: {
    question: OcrQuestion;
    resolved: ReturnType<typeof resolveOcrQuestions>[number];
    index: number;
    onChange: (field: string, val: string) => void;
    onRemove: () => void;
}) {
    const [expanded, setExpanded] = useState(true);

    return (
        <div className="bg-surface border border-surface-variant rounded-[12px] p-3">
            <div className="flex justify-between items-start gap-2">
                <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1.5 text-left flex-1 min-w-0">
                    <span className="text-xs font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full flex-shrink-0">#{question.source_number ?? index + 1}</span>
                    <span className="text-sm font-medium text-on-surface truncate">{question.question_text}</span>
                    {expanded ? <ChevronUp className="w-4 h-4 text-secondary flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-secondary flex-shrink-0" />}
                </button>
                <button onClick={onRemove} aria-label="Keluarkan soal dari daftar simpan" className="w-6 h-6 rounded-full bg-red-50 text-red-400 flex items-center justify-center flex-shrink-0">
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>

            {expanded && (
                <div className="mt-3 flex flex-col gap-2">
                    {resolved.issues.map(issue => <p key={issue} className="text-xs font-medium text-amber-700">{issue}</p>)}
                    {resolved.context && (
                        <p className="whitespace-pre-wrap rounded-lg bg-surface-container p-2 text-xs text-on-surface">{resolved.context}</p>
                    )}
                    <textarea
                        className="w-full bg-surface-container border border-surface-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none resize-none"
                        rows={2}
                        value={question.question_text}
                        onChange={e => onChange('question_text', e.target.value)}
                        placeholder="Teks soal..."
                    />
                    <QuizImages images={resolved.images} field="question_text" />
                    {question.question_type === 'MCQ' && (
                        <div className="grid grid-cols-2 gap-1.5">
                            {QUIZ_FIELDS.slice(1, 5).map((field, optionIndex) => (
                                <div key={field}>
                                    <input
                                        className="w-full bg-surface-container border border-surface-variant rounded-lg px-2 py-1.5 text-xs text-on-surface focus:outline-none"
                                        value={question[field] || ''}
                                        onChange={e => onChange(field, e.target.value)}
                                        placeholder={`Opsi ${'ABCD'[optionIndex]}`}
                                    />
                                    <QuizImages images={resolved.images} field={field} />
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-secondary">Jawaban:</span>
                        <input
                            className="w-16 bg-mint-bg/30 border border-mint-fg/30 text-mint-fg rounded-lg px-2 py-1 text-xs font-bold text-center focus:outline-none"
                            value={question.correct_answer || '?'}
                            onChange={e => onChange('correct_answer', e.target.value)}
                        />
                        <span className="text-[10px] text-secondary">(A/B/C/D atau teks untuk essay)</span>
                    </div>
                    <QuizImages images={resolved.images} field="correct_answer" />
                </div>
            )}
        </div>
    );
}
