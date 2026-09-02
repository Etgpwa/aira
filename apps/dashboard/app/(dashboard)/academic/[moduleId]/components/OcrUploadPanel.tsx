'use client';

import { useState, useTransition } from 'react';
import { Camera, Key, Plus, Loader2, Check, X, ChevronDown, ChevronUp } from 'lucide-react';
import { ocrSoal, ocrKunciJawaban, applyKunciToModule, saveQuestions } from '../../actions';
import ManualQuizInput from '../../components/ManualQuizInput';
import { useRouter } from 'next/navigation';

interface OcrUploadPanelProps {
    moduleId: string;
    subjectName: string;
}

export default function OcrUploadPanel({ moduleId, subjectName }: OcrUploadPanelProps) {
    const [activePanel, setActivePanel] = useState<'none' | 'soal' | 'kunci' | 'manual'>('none');
    const [isPending, startTransition] = useTransition();
    const [previewQuestions, setPreviewQuestions] = useState<any[] | null>(null);
    const [kunciResult, setKunciResult] = useState<Record<number, string> | null>(null);
    const [status, setStatus] = useState<string>('');
    const router = useRouter();

    const handleFileToBase64 = (file: File): Promise<{ base64: string; mimeType: string }> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const result = reader.result as string;
                const base64 = result.split(',')[1];
                resolve({ base64, mimeType: file.type });
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    const handleScanSoal = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setStatus('Menganalisis foto dengan Gemini AI...');
        startTransition(async () => {
            try {
                const { base64, mimeType } = await handleFileToBase64(file);
                const result = await ocrSoal(base64, mimeType, subjectName);
                setPreviewQuestions(result);
                setStatus(result.length > 0 ? `Ditemukan ${result.length} soal. Periksa & simpan di bawah.` : 'Tidak ada soal terdeteksi.');
            } catch (err) {
                setStatus('Gagal scan soal. Coba lagi.');
                console.error(err);
            }
        });
        e.target.value = '';
    };

    const handleScanKunci = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setStatus('Membaca kunci jawaban...');
        startTransition(async () => {
            try {
                const { base64, mimeType } = await handleFileToBase64(file);
                const result = await ocrKunciJawaban(base64, mimeType);
                setKunciResult(result);
                const count = Object.keys(result).length;
                setStatus(count > 0 ? `Kunci jawaban untuk ${count} soal terdeteksi. Konfirmasi untuk diterapkan.` : 'Kunci jawaban tidak terbaca.');
            } catch (err) {
                setStatus('Gagal scan kunci. Coba lagi.');
                console.error(err);
            }
        });
        e.target.value = '';
    };

    const handleApplyKunci = () => {
        if (!kunciResult) return;
        startTransition(async () => {
            await applyKunciToModule(moduleId, kunciResult);
            setKunciResult(null);
            setStatus('Kunci jawaban berhasil diterapkan!');
            router.refresh();
        });
    };

    const handleSavePreview = () => {
        if (!previewQuestions || previewQuestions.length === 0) return;
        startTransition(async () => {
            await saveQuestions(previewQuestions, moduleId);
            setPreviewQuestions(null);
            setStatus('Soal berhasil disimpan!');
            router.refresh();
        });
    };

    const updatePreviewQ = (idx: number, field: string, value: string) => {
        if (!previewQuestions) return;
        const updated = [...previewQuestions];
        updated[idx] = { ...updated[idx], [field]: value };
        setPreviewQuestions(updated);
    };

    const removePreviewQ = (idx: number) => {
        if (!previewQuestions) return;
        setPreviewQuestions(previewQuestions.filter((_, i) => i !== idx));
    };

    return (
        <div className="flex flex-col gap-3">
            {/* Action Buttons Row */}
            <div className="grid grid-cols-3 gap-2">
                {/* Scan Soal */}
                <label className={`flex flex-col items-center gap-1.5 p-3 rounded-[14px] border-2 cursor-pointer transition-all active:scale-95 ${activePanel === 'soal' ? 'border-primary bg-primary/5' : 'border-surface-variant bg-surface-bright'}`}>
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleScanSoal} />
                    <Camera className="w-5 h-5 text-primary" />
                    <span className="text-[11px] font-bold text-on-surface text-center leading-tight">Scan Soal</span>
                </label>

                {/* Scan Kunci */}
                <label className={`flex flex-col items-center gap-1.5 p-3 rounded-[14px] border-2 cursor-pointer transition-all active:scale-95 ${activePanel === 'kunci' ? 'border-amber-400 bg-amber-50' : 'border-surface-variant bg-surface-bright'}`}>
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleScanKunci} />
                    <Key className="w-5 h-5 text-amber-500" />
                    <span className="text-[11px] font-bold text-on-surface text-center leading-tight">Scan Kunci</span>
                </label>

                {/* Input Manual */}
                <button
                    onClick={() => setActivePanel(prev => prev === 'manual' ? 'none' : 'manual')}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-[14px] border-2 transition-all active:scale-95 ${activePanel === 'manual' ? 'border-mint-fg bg-mint-bg/20' : 'border-surface-variant bg-surface-bright'}`}
                >
                    <Plus className="w-5 h-5 text-mint-fg" />
                    <span className="text-[11px] font-bold text-on-surface text-center leading-tight">Manual</span>
                </button>
            </div>

            {/* Status message */}
            {(isPending || status) && (
                <div className={`rounded-[12px] px-4 py-2.5 text-sm font-medium flex items-center gap-2 ${isPending ? 'bg-primary/10 text-primary' : status.includes('Gagal') ? 'bg-red-50 text-red-600' : 'bg-mint-bg/20 text-mint-fg'}`}>
                    {isPending && <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />}
                    {!isPending && <Check className="w-4 h-4 flex-shrink-0" />}
                    {isPending ? 'Memproses...' : status}
                </div>
            )}

            {/* Kunci Jawaban Preview */}
            {kunciResult && Object.keys(kunciResult).length > 0 && !isPending && (
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
            {previewQuestions && previewQuestions.length > 0 && !isPending && (
                <div className="bg-surface-bright border border-surface-variant rounded-[16px] p-4">
                    <div className="flex justify-between items-center mb-3">
                        <p className="font-bold text-on-surface">Preview {previewQuestions.length} Soal</p>
                        <span className="text-xs text-secondary">Periksa & edit sebelum simpan</span>
                    </div>
                    <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto">
                        {previewQuestions.map((q, idx) => (
                            <PreviewQuestionCard
                                key={idx}
                                question={q}
                                index={idx}
                                onChange={(field, val) => updatePreviewQ(idx, field, val)}
                                onRemove={() => removePreviewQ(idx)}
                            />
                        ))}
                    </div>
                    <div className="flex gap-2 mt-4">
                        <button onClick={() => setPreviewQuestions(null)} className="flex-1 bg-surface-container text-secondary py-2.5 rounded-full font-bold text-sm">Batal</button>
                        <button onClick={handleSavePreview} className="flex-1 bg-primary text-on-primary py-2.5 rounded-full font-bold text-sm flex items-center justify-center gap-1.5">
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
function PreviewQuestionCard({ question, index, onChange, onRemove }: {
    question: any;
    index: number;
    onChange: (field: string, val: string) => void;
    onRemove: () => void;
}) {
    const [expanded, setExpanded] = useState(true);

    return (
        <div className="bg-surface border border-surface-variant rounded-[12px] p-3">
            <div className="flex justify-between items-start gap-2">
                <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1.5 text-left flex-1 min-w-0">
                    <span className="text-xs font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full flex-shrink-0">#{index + 1}</span>
                    <span className="text-sm font-medium text-on-surface truncate">{question.question_text}</span>
                    {expanded ? <ChevronUp className="w-4 h-4 text-secondary flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-secondary flex-shrink-0" />}
                </button>
                <button onClick={onRemove} className="w-6 h-6 rounded-full bg-red-50 text-red-400 flex items-center justify-center flex-shrink-0">
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>

            {expanded && (
                <div className="mt-3 flex flex-col gap-2">
                    <textarea
                        className="w-full bg-surface-container border border-surface-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none resize-none"
                        rows={2}
                        value={question.question_text}
                        onChange={e => onChange('question_text', e.target.value)}
                        placeholder="Teks soal..."
                    />
                    {question.question_type === 'MCQ' && (
                        <div className="grid grid-cols-2 gap-1.5">
                            {['a', 'b', 'c', 'd'].map(opt => (
                                <input
                                    key={opt}
                                    className="w-full bg-surface-container border border-surface-variant rounded-lg px-2 py-1.5 text-xs text-on-surface focus:outline-none"
                                    value={question[`option_${opt}`] || ''}
                                    onChange={e => onChange(`option_${opt}`, e.target.value)}
                                    placeholder={`Opsi ${opt.toUpperCase()}`}
                                />
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
                </div>
            )}
        </div>
    );
}
