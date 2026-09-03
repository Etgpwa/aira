'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
    Bot, Send, Sparkles, BookOpen, Trash2, CheckCircle2, 
    AlertCircle, RefreshCw, X, ChevronDown, ChevronUp, 
    Layers, ArrowRight, ShieldCheck, PlusCircle, Check
} from 'lucide-react';
import { 
    simulateKarenChat, saveTrainingRule, getTrainingRules, 
    toggleTrainingRule, deleteTrainingRule, SimulationResult, 
    TrainingRule 
} from './actions';

interface ChatMessage {
    id: string;
    sender: 'user' | 'assistant';
    text: string;
    timestamp: string;
    simulation?: SimulationResult;
}

const COMMON_INTENTS = [
    'ADD_EXPENSE', 'ADD_INCOME', 'ADD_TASK', 'ADD_REMINDER', 
    'RESCHEDULE_REMINDER', 'UPDATE_TASK_PROGRESS', 'PAY_DEBT', 
    'ADD_RECEIVABLE', 'TOPUP_GOAL', 'QUERY_FINANCE', 'QUERY_AGENDA'
];

export default function SandboxPage() {
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: 'welcome',
            sender: 'assistant',
            text: 'Halo! Ini ruang uji coba & pelatihan AI Karen. Kamu bisa menguji berbagai kalimat di sini. Karen akan membaca data aslimu sebagai patokan, tapi semua aksi di sini bersifat simulasi aman (dry run). Kalau jawaban atau intent-ku salah, klik tombol "Koreksi" di bawah pesan untuk mengajariku!',
            timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
        }
    ]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [rules, setRules] = useState<TrainingRule[]>([]);
    const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
    const [correctionTarget, setCorrectionTarget] = useState<{ userText: string; detectedIntents: string[] } | null>(null);
    const [selectedIntents, setSelectedIntents] = useState<string[]>([]);
    const [explanationText, setExplanationText] = useState('');
    const [isSavingRule, setIsSavingRule] = useState(false);
    const [feedbackToast, setFeedbackToast] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Load aturan yang sudah dipelajari saat pertama kali mount
    useEffect(() => {
        loadRules();
    }, []);

    // Auto-scroll ke pesan terbawah
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    const loadRules = async () => {
        try {
            const data = await getTrainingRules();
            setRules(data);
        } catch (err) {
            console.error('Failed to load rules:', err);
        }
    };

    const showToast = (msg: string) => {
        setFeedbackToast(msg);
        setTimeout(() => setFeedbackToast(null), 3500);
    };

    const handleSendMessage = async (customText?: string) => {
        const textToSend = customText || inputText;
        if (!textToSend.trim() || isLoading) return;

        const userMsgId = Date.now().toString();
        const userMsg: ChatMessage = {
            id: userMsgId,
            sender: 'user',
            text: textToSend.trim(),
            timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
        };

        const updatedMessages = [...messages, userMsg];
        setMessages(updatedMessages);
        if (!customText) setInputText('');
        setIsLoading(true);

        try {
            // Siapkan riwayat chat pendek untuk konteks
            const history = updatedMessages.slice(-6).map(m => ({
                sender: m.sender,
                text: m.text
            }));

            const result = await simulateKarenChat(textToSend.trim(), history);

            const aiMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                sender: 'assistant',
                text: result.reply || '(Respon tanpa teks)',
                timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
                simulation: result
            };

            setMessages(prev => [...prev, aiMsg]);
        } catch (error: any) {
            const errorMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                sender: 'assistant',
                text: `Terjadi kendala koneksi AI: ${error.message || 'Coba periksa GEMINI_API_KEY'}`,
                timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenCorrection = (msg: ChatMessage) => {
        // Cari pesan user tepat sebelum respon Karen ini
        const msgIndex = messages.findIndex(m => m.id === msg.id);
        const prevUserMsg = msgIndex > 0 ? messages[msgIndex - 1] : null;
        const userText = prevUserMsg ? prevUserMsg.text : '';
        const detected = msg.simulation?.intents?.map(i => i.intent) || [];

        setCorrectionTarget({
            userText,
            detectedIntents: detected
        });
        setSelectedIntents(detected.length > 0 ? detected : ['ADD_TASK']);
        setExplanationText('');
    };

    const handleSaveCorrection = async () => {
        if (!correctionTarget || selectedIntents.length === 0) return;
        setIsSavingRule(true);

        try {
            const formattedIntents = selectedIntents.map(intentName => ({
                intent: intentName,
                entities: {}
            }));

            await saveTrainingRule(
                correctionTarget.userText,
                formattedIntents,
                explanationText.trim() || undefined
            );

            await loadRules();
            setCorrectionTarget(null);
            showToast('Aturan baru berhasil dipelajari! Otomatis aktif di WhatsApp.');

            // Beri pesan asisten konfirmasi di dalam chat
            setMessages(prev => [
                ...prev,
                {
                    id: Date.now().toString(),
                    sender: 'assistant',
                    text: `Terima kasih atas koreksinya! Aku sudah menyimpan aturan untuk pola kalimat: "${correctionTarget.userText}". Sekarang aku tahu maksudnya adalah [${selectedIntents.join(', ')}].`,
                    timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
                }
            ]);
        } catch (err: any) {
            alert(`Gagal menyimpan aturan: ${err.message}`);
        } finally {
            setIsSavingRule(false);
        }
    };

    const handleToggleRule = async (ruleId: string, currentStatus: boolean) => {
        try {
            await toggleTrainingRule(ruleId, !currentStatus);
            setRules(prev => prev.map(r => r.id === ruleId ? { ...r, is_active: !currentStatus } : r));
            showToast(!currentStatus ? 'Aturan diaktifkan' : 'Aturan dinonaktifkan');
        } catch (err: any) {
            alert(`Gagal mengubah status: ${err.message}`);
        }
    };

    const handleDeleteRule = async (ruleId: string) => {
        if (!confirm('Hapus aturan pelatihan ini?')) return;
        try {
            await deleteTrainingRule(ruleId);
            setRules(prev => prev.filter(r => r.id !== ruleId));
            showToast('Aturan berhasil dihapus');
        } catch (err: any) {
            alert(`Gagal menghapus aturan: ${err.message}`);
        }
    };

    const handleClearChat = () => {
        if (!confirm('Bersihkan percakapan simulasi saat ini?')) return;
        setMessages([
            {
                id: 'welcome-reset',
                sender: 'assistant',
                text: 'Sesi chat telah dibersihkan. Silakan coba instruksi lainnya!',
                timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
            }
        ]);
    };

    const toggleIntentSelection = (intent: string) => {
        if (selectedIntents.includes(intent)) {
            if (selectedIntents.length > 1) {
                setSelectedIntents(selectedIntents.filter(i => i !== intent));
            }
        } else {
            setSelectedIntents([...selectedIntents, intent]);
        }
    };

    return (
        <div className="flex flex-col h-[calc(100dvh-5rem)] md:h-[calc(100vh-2rem)] max-w-5xl mx-auto px-2 md:px-6 py-2">
            {/* ── Top Header ────────────────────────────────────────── */}
            <div className="flex items-center justify-between bg-surface/90 backdrop-blur-xl border border-surface-variant rounded-2xl px-4 py-3 shadow-sm mb-3">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-primary-light flex items-center justify-center text-white shadow-md">
                            <Bot className="w-6 h-6" />
                        </div>
                        <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-surface rounded-full"></span>
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-base md:text-lg font-bold text-on-surface">Karen AI Simulator</h1>
                            <span className="text-[10px] uppercase tracking-wider font-extrabold bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full">
                                Dry Run
                            </span>
                        </div>
                        <p className="text-xs text-secondary hidden sm:block">
                            Simulasi pesan aman & pelatihan intent instan
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsRulesModalOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline/20 text-xs font-semibold text-on-surface transition-all active:scale-95"
                    >
                        <BookOpen className="w-4 h-4 text-primary" />
                        <span>Aturan ({rules.length})</span>
                    </button>

                    <button
                        onClick={handleClearChat}
                        title="Bersihkan chat"
                        className="p-2 rounded-xl text-secondary hover:text-error hover:bg-error/10 transition-all active:scale-95"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* ── Banner Info Simulasi ──────────────────────────────── */}
            <div className="bg-primary/5 border border-primary/20 rounded-xl px-3 py-2 mb-3 flex items-start gap-2 text-xs text-on-surface-variant">
                <ShieldCheck className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <div>
                    <span className="font-semibold text-primary">Simulasi Aman:</span> Percakapan ini menggunakan saldo & tugas aslimu sebagai patokan, namun tidak mengubah database nyata. Jika deteksi intent keliru, klik tombol <span className="font-bold underline text-primary">Koreksi</span> untuk melatih Karen!
                </div>
            </div>

            {/* ── Toast Feedback ────────────────────────────────────── */}
            {feedbackToast && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-on-surface text-inverse-on-surface px-4 py-2.5 rounded-full shadow-lg text-xs font-semibold flex items-center gap-2 animate-bounce">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>{feedbackToast}</span>
                </div>
            )}

            {/* ── Chat Messages Container ───────────────────────────── */}
            <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4 rounded-2xl bg-surface-container-lowest border border-surface-variant/60 shadow-inner">
                {messages.map((msg) => {
                    const isUser = msg.sender === 'user';
                    const sim = msg.simulation;

                    return (
                        <div 
                            key={msg.id} 
                            className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-full`}
                        >
                            <div className="flex items-end gap-2 max-w-[92%] sm:max-w-[80%]">
                                {!isUser && (
                                    <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center flex-shrink-0 mb-1">
                                        <Bot className="w-4 h-4" />
                                    </div>
                                )}

                                <div className={`
                                    rounded-2xl px-4 py-2.5 shadow-sm text-sm
                                    ${isUser 
                                        ? 'bg-primary text-white rounded-br-none' 
                                        : 'bg-surface border border-surface-variant text-on-surface rounded-bl-none'
                                    }
                                `}>
                                    <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                                    <span className={`text-[10px] block mt-1 text-right ${isUser ? 'text-white/70' : 'text-secondary'}`}>
                                        {msg.timestamp}
                                    </span>
                                </div>
                            </div>

                            {/* ── Breakdown Intent & Simulasi untuk Balasan Karen ── */}
                            {!isUser && sim && (
                                <div className="mt-2 ml-9 max-w-[90%] sm:max-w-[78%] w-full bg-surface border border-primary/20 rounded-xl p-3 shadow-sm text-xs space-y-2">
                                    <div className="flex items-center justify-between border-b border-surface-variant pb-1.5">
                                        <div className="flex items-center gap-1.5 text-primary font-bold">
                                            <Sparkles className="w-3.5 h-3.5" />
                                            <span>Deteksi Intent & Dampak Simulasi</span>
                                        </div>
                                        <button
                                            onClick={() => handleOpenCorrection(msg)}
                                            className="flex items-center gap-1 text-[11px] font-bold text-primary hover:text-primary-dark bg-primary/10 hover:bg-primary/20 px-2 py-0.5 rounded-md transition-colors"
                                        >
                                            <RefreshCw className="w-3 h-3" />
                                            <span>Koreksi Karen</span>
                                        </button>
                                    </div>

                                    {/* Chip Intents */}
                                    <div className="flex flex-wrap gap-1.5">
                                        {sim.intents.length > 0 ? (
                                            sim.intents.map((it, idx) => (
                                                <span 
                                                    key={idx} 
                                                    className="bg-primary/10 text-primary border border-primary/25 px-2 py-0.5 rounded-md font-mono text-[11px] font-semibold"
                                                >
                                                    {it.intent}
                                                </span>
                                            ))
                                        ) : (
                                            <span className="text-secondary italic">Tidak ada intent khusus (Chitchat)</span>
                                        )}
                                    </div>

                                    {/* Dampak Simulasi */}
                                    {sim.simulatedImpacts.length > 0 && (
                                        <div className="space-y-1.5 pt-1">
                                            {sim.simulatedImpacts.map((imp, idx) => (
                                                <div key={idx} className="bg-surface-container/60 rounded-lg p-2 border border-surface-variant">
                                                    <p className="font-semibold text-on-surface">{imp.type}: {imp.description}</p>
                                                    {imp.details && (
                                                        <p className="text-[11px] text-primary font-medium mt-0.5">{imp.details}</p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}

                {isLoading && (
                    <div className="flex items-center gap-2 text-secondary text-xs ml-9">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-primary" />
                        <span>Karen sedang menganalisis pesan & mensimulasikan aksi...</span>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* ── Quick Prompt Suggestions ──────────────────────────── */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-2 no-scrollbar">
                <span className="text-[11px] text-secondary font-medium whitespace-nowrap pl-1">Coba tes:</span>
                {[
                    'Beli bensin 30k pakai SeaBank',
                    'A tuker cash 50k transfer ke BCA 50k',
                    'Nanti jam 4 sore ingetin kerjain tugas web',
                    'Cek saldo dan sisa tabungan'
                ].map((prompt, idx) => (
                    <button
                        key={idx}
                        onClick={() => handleSendMessage(prompt)}
                        className="text-[11px] font-medium bg-surface hover:bg-surface-container border border-surface-variant text-secondary hover:text-on-surface rounded-full px-3 py-1 whitespace-nowrap transition-all active:scale-95"
                    >
                        {prompt}
                    </button>
                ))}
            </div>

            {/* ── Chat Input Area ───────────────────────────────────── */}
            <form 
                onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                }}
                className="flex items-center gap-2 pt-1"
            >
                <div className="relative flex-1">
                    <input
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="Ketik instruksi chat di sini..."
                        className="w-full bg-surface border border-surface-variant rounded-xl px-4 py-3 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all shadow-sm"
                        disabled={isLoading}
                    />
                </div>
                <button
                    type="submit"
                    disabled={!inputText.trim() || isLoading}
                    className="h-11 px-5 rounded-xl bg-primary text-white font-semibold flex items-center justify-center gap-1.5 hover:bg-primary-dark transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md active:scale-95"
                >
                    <Send className="w-4 h-4" />
                    <span className="hidden sm:inline text-xs">Kirim</span>
                </button>
            </form>

            {/* ── MODAL KOREKSI / LATIH KAREN ───────────────────────── */}
            {correctionTarget && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-surface border border-surface-variant rounded-2xl w-full max-w-lg p-5 shadow-2xl space-y-4 max-h-[90dvh] overflow-y-auto">
                        <div className="flex items-center justify-between border-b border-surface-variant pb-3">
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-primary" />
                                <h3 className="font-bold text-on-surface text-base">Latih Pemahaman Karen</h3>
                            </div>
                            <button 
                                onClick={() => setCorrectionTarget(null)}
                                className="p-1.5 rounded-lg text-secondary hover:text-on-surface hover:bg-surface-container"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Pesan Yang Dikoreksi */}
                        <div className="bg-surface-container/60 rounded-xl p-3 border border-surface-variant space-y-1">
                            <p className="text-[11px] font-semibold text-secondary">Pesan User yang Diuji:</p>
                            <p className="text-sm font-bold text-on-surface">"{correctionTarget.userText}"</p>
                            <p className="text-[11px] text-secondary mt-1">
                                Deteksi sebelumnya: <span className="font-mono text-error font-semibold">{correctionTarget.detectedIntents.join(', ') || 'UNKNOWN'}</span>
                            </p>
                        </div>

                        {/* Pilihan Intent yang Benar */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-on-surface block">
                                1. Pilih Intent yang Seharusnya (Bisa Multi-Intent):
                            </label>
                            <div className="flex flex-wrap gap-1.5">
                                {COMMON_INTENTS.map((intent) => {
                                    const isSelected = selectedIntents.includes(intent);
                                    return (
                                        <button
                                            key={intent}
                                            type="button"
                                            onClick={() => toggleIntentSelection(intent)}
                                            className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition-all border ${
                                                isSelected 
                                                    ? 'bg-primary text-white border-primary shadow-sm' 
                                                    : 'bg-surface-container text-secondary border-transparent hover:border-outline/30'
                                            }`}
                                        >
                                            {intent}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Input Penjelasan / Aturan Tambahan */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-on-surface block">
                                2. Aturan / Penjelasan Tambahan (Opsional):
                            </label>
                            <textarea
                                value={explanationText}
                                onChange={(e) => setExplanationText(e.target.value)}
                                placeholder="Misal: Jika ada kata 'ingetin kerjain', buat 2 intent sekaligus yaitu ADD_TASK dan ADD_REMINDER"
                                rows={2}
                                className="w-full bg-surface border border-surface-variant rounded-xl p-3 text-xs text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                            />
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-variant">
                            <button
                                type="button"
                                onClick={() => setCorrectionTarget(null)}
                                className="px-4 py-2 rounded-xl text-xs font-semibold text-secondary hover:bg-surface-container transition-all"
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveCorrection}
                                disabled={isSavingRule || selectedIntents.length === 0}
                                className="px-5 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-dark transition-all disabled:opacity-50 flex items-center gap-1.5 shadow-md active:scale-95"
                            >
                                {isSavingRule ? (
                                    <>
                                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                        <span>Menyimpan...</span>
                                    </>
                                ) : (
                                    <>
                                        <Check className="w-3.5 h-3.5" />
                                        <span>Simpan & Terapkan ke WhatsApp</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── MODAL DAFTAR ATURAN PELATIHAN ─────────────────────── */}
            {isRulesModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-surface border border-surface-variant rounded-2xl w-full max-w-xl p-5 shadow-2xl space-y-4 max-h-[85dvh] flex flex-col">
                        <div className="flex items-center justify-between border-b border-surface-variant pb-3">
                            <div className="flex items-center gap-2">
                                <BookOpen className="w-5 h-5 text-primary" />
                                <h3 className="font-bold text-on-surface text-base">Aturan Pelatihan Tersimpan ({rules.length})</h3>
                            </div>
                            <button 
                                onClick={() => setIsRulesModalOpen(false)}
                                className="p-1.5 rounded-lg text-secondary hover:text-on-surface hover:bg-surface-container"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <p className="text-xs text-secondary">
                            Aturan di bawah ini disuntikkan secara dinamis ke prompt Karen baik di PWA Simulator maupun di Bot WhatsApp nyata.
                        </p>

                        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                            {rules.length === 0 ? (
                                <div className="text-center py-8 text-secondary text-xs">
                                    Belum ada aturan kustom. Coba uji pesan di Simulator dan klik tombol "Koreksi" untuk menambahkan aturan pertama!
                                </div>
                            ) : (
                                rules.map((r) => (
                                    <div 
                                        key={r.id} 
                                        className={`p-3.5 rounded-xl border transition-all ${
                                            r.is_active 
                                                ? 'bg-surface border-surface-variant' 
                                                : 'bg-surface-container/40 border-dashed border-outline/30 opacity-60'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <p className="text-xs font-bold text-on-surface">"{r.sample_phrase}"</p>
                                                {r.explanation_rule && (
                                                    <p className="text-[11px] text-secondary mt-1">{r.explanation_rule}</p>
                                                )}
                                                <div className="flex flex-wrap gap-1 mt-2">
                                                    {r.expected_intents?.map((it: any, idx: number) => (
                                                        <span 
                                                            key={idx}
                                                            className="text-[10px] font-mono font-semibold bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded"
                                                        >
                                                            {it.intent || it}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <button
                                                    onClick={() => handleToggleRule(r.id, r.is_active)}
                                                    className={`text-[10px] font-bold px-2 py-1 rounded-md border transition-all ${
                                                        r.is_active 
                                                            ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
                                                            : 'bg-surface-container text-secondary border-outline/20'
                                                    }`}
                                                >
                                                    {r.is_active ? 'Aktif' : 'Non-Aktif'}
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteRule(r.id)}
                                                    className="p-1 rounded-md text-secondary hover:text-error hover:bg-error/10 transition-colors"
                                                    title="Hapus aturan"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="pt-2 border-t border-surface-variant flex justify-end">
                            <button
                                onClick={() => setIsRulesModalOpen(false)}
                                className="px-4 py-2 rounded-xl bg-surface-container text-on-surface text-xs font-bold hover:bg-surface-container-high transition-all"
                            >
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
