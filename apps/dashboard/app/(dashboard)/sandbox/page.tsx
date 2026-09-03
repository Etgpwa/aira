'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { 
    Bot, Send, Sparkles, BookOpen, Trash2, CheckCircle2, 
    AlertCircle, RefreshCw, X, ChevronDown, ChevronUp, 
    Layers, ArrowRight, ArrowLeft, ShieldCheck, PlusCircle, Check, RotateCcw
} from 'lucide-react';
import { 
    simulateKarenChat, saveTrainingRule, getTrainingRules, 
    toggleTrainingRule, deleteTrainingRule, SimulationResult, 
    TrainingRule 
} from './actions';

interface ChatMessage {
    id: string;
    sender: 'user' | 'assistant' | 'system_divider';
    text: string;
    timestamp: string;
    simulation?: SimulationResult;
    promotedRule?: {
        phrase: string;
        intents: string[];
        explanation?: string;
    };
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
            // ── CONTEXT BOUNDARY RESET LOGIC ─────────────────────────────
            // Cari divider terakhir (Promote to Memory / Reset Sesi)
            const lastDividerIndex = updatedMessages.map(m => m.sender).lastIndexOf('system_divider');
            const activeHistoryMessages = lastDividerIndex >= 0 
                ? updatedMessages.slice(lastDividerIndex + 1) 
                : updatedMessages;

            // Ambil pesan sebelum userMsg saat ini (maksimal 6 percakapan dalam sesi aktif)
            const history = activeHistoryMessages
                .slice(0, -1)
                .filter(m => m.sender === 'user' || m.sender === 'assistant')
                .slice(-6)
                .map(m => ({
                    sender: m.sender as 'user' | 'assistant',
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

    // ── PROMOTE TO MEMORY: Kunci Aturan & Reset Boundary Konteks ──
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
            showToast('Aturan dipromosikan ke Memory! Sesi ingatan di-reset.');

            // 1. Sisipkan Garis Batas Konteks (Context Boundary Divider)
            const dividerMsg: ChatMessage = {
                id: `divider-${Date.now()}`,
                sender: 'system_divider',
                text: `Aturan Dipromosikan ke Memory: "${correctionTarget.userText}"`,
                timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
                promotedRule: {
                    phrase: correctionTarget.userText,
                    intents: selectedIntents,
                    explanation: explanationText.trim() || undefined
                }
            };

            // 2. Beri pesan asisten konfirmasi di awal sesi baru
            const assistantAckMsg: ChatMessage = {
                id: `ack-${Date.now() + 1}`,
                sender: 'assistant',
                text: `Aturan baru berhasil dipelajari! Aku sudah mereset ingatan sesi percakapan sebelumnya. Silakan uji aku dengan pertanyaan baru untuk memvalidasi pemahamanku.`,
                timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
            };

            setMessages(prev => [...prev, dividerMsg, assistantAckMsg]);
        } catch (err: any) {
            alert(`Gagal mempromosikan aturan: ${err.message}`);
        } finally {
            setIsSavingRule(false);
        }
    };

    // ── RESET MANUAL KONTEKS SESI ──
    const handleManualResetContext = () => {
        const dividerMsg: ChatMessage = {
            id: `divider-${Date.now()}`,
            sender: 'system_divider',
            text: 'Konteks Sesi Direset Secara Manual',
            timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
        };
        const ackMsg: ChatMessage = {
            id: `ack-${Date.now() + 1}`,
            sender: 'assistant',
            text: 'Ingatan percakapan sesi sebelumnya telah di-reset. Riwayat di atas tetap disimpan sebagai referensi visual. Silakan mulai pertanyaan baru!',
            timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [...prev, dividerMsg, ackMsg]);
        showToast('Konteks sesi telah di-reset ke kondisi bersih');
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
        <div className="
            -mx-4 -mt-6 -mb-28 h-[100dvh]
            flex flex-col
            bg-background
            md:mx-auto md:my-0 md:h-[calc(100vh-5rem)] md:max-w-4xl md:rounded-2xl md:border md:border-surface-variant md:shadow-lg
            overflow-hidden
        ">
            {/* ── Fixed Top Dock (Header & Slim Banner) ────────────────────────── */}
            <div className="flex-none bg-surface/95 backdrop-blur-md border-b border-surface-variant z-20">
                <div className="flex items-center justify-between px-3 md:px-5 py-2.5">
                    {/* Left: Back (mobile), Avatar, Name, Status */}
                    <div className="flex items-center gap-2 md:gap-3 min-w-0">
                        <Link 
                            href="/"
                            title="Kembali ke Dashboard"
                            className="md:hidden p-1.5 -ml-1 text-secondary hover:text-on-surface hover:bg-surface-container rounded-lg transition-colors flex-shrink-0"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Link>

                        <div className="relative flex-shrink-0">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-primary to-primary-light flex items-center justify-center text-white shadow-sm">
                                <Bot className="w-5 h-5" />
                            </div>
                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-surface rounded-full"></span>
                        </div>

                        <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                                <h1 className="text-sm md:text-base font-bold text-on-surface truncate">Karen</h1>
                                <span className="text-[9px] uppercase tracking-wider font-extrabold bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.2 rounded-full flex-shrink-0">
                                    Dry Run
                                </span>
                            </div>
                            <p className="text-[10px] text-emerald-600 font-semibold truncate flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                AI Simulator Aktif
                            </p>
                        </div>
                    </div>

                    {/* Right: Actions (Reset Sesi, Aturan, Clear) */}
                    <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
                        <button
                            onClick={handleManualResetContext}
                            title="Reset ingatan percakapan sesi ini (mulai sesi bersih)"
                            className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline/20 text-xs font-semibold text-secondary hover:text-on-surface transition-all active:scale-95 flex items-center gap-1"
                        >
                            <RotateCcw className="w-3.5 h-3.5 text-primary" />
                            <span className="hidden sm:inline">Reset</span>
                        </button>

                        <button
                            onClick={() => setIsRulesModalOpen(true)}
                            className="px-2.5 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline/20 text-xs font-semibold text-on-surface transition-all active:scale-95 flex items-center gap-1"
                        >
                            <BookOpen className="w-3.5 h-3.5 text-primary" />
                            <span>Aturan ({rules.length})</span>
                        </button>

                        <button
                            onClick={handleClearChat}
                            title="Bersihkan chat"
                            className="p-2 rounded-xl text-secondary hover:text-error hover:bg-error/10 transition-all active:scale-95"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>

                {/* Slim 1-line Info Bar */}
                <div className="bg-primary/5 border-t border-primary/10 px-3 py-1 flex items-center justify-between text-[11px] text-on-surface-variant">
                    <div className="flex items-center gap-1.5 truncate">
                        <ShieldCheck className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                        <span className="truncate">Data asli aman • Bersifat dry-run</span>
                    </div>
                    <span className="text-[10px] text-primary font-bold whitespace-nowrap ml-2">Clean State</span>
                </div>
            </div>

            {/* ── Toast Feedback ────────────────────────────────────── */}
            {feedbackToast && (
                <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-on-surface text-inverse-on-surface px-4 py-2 rounded-full shadow-lg text-xs font-semibold flex items-center gap-2 animate-bounce">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>{feedbackToast}</span>
                </div>
            )}

            {/* ── Chat Messages Container (The ONLY scrollable section) ───────── */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-3 space-y-3 bg-surface-container-lowest">
                {messages.map((msg) => {
                    // ── RENDER SYSTEM DIVIDER (CONTEXT BOUNDARY RESET) ──
                    if (msg.sender === 'system_divider') {
                        return (
                            <div key={msg.id} className="py-2 flex flex-col items-center justify-center my-1 w-full animate-in fade-in">
                                <div className="w-full flex items-center justify-center gap-2 relative">
                                    <div className="flex-1 border-t border-dashed border-primary/30"></div>
                                    <div className="bg-surface px-3 py-1 rounded-full border border-primary/25 shadow-sm flex items-center gap-1.5 text-[11px] text-primary font-bold">
                                        <Sparkles className="w-3 h-3 text-primary" />
                                        <span>Promote to Memory • Sesi Direset</span>
                                        <span className="text-[10px] text-secondary font-normal">({msg.timestamp})</span>
                                    </div>
                                    <div className="flex-1 border-t border-dashed border-primary/30"></div>
                                </div>
                                {msg.promotedRule && (
                                    <div className="mt-2 bg-primary/5 border border-primary/20 rounded-xl px-3 py-2 text-center max-w-md w-full shadow-sm">
                                        <p className="text-xs font-medium text-on-surface break-words">
                                            Pola Baru: <span className="font-bold text-primary">"{msg.promotedRule.phrase}"</span>
                                        </p>
                                        <div className="flex flex-wrap justify-center gap-1 mt-1">
                                            {msg.promotedRule.intents.map((it, idx) => (
                                                <span key={idx} className="text-[10px] font-mono font-bold bg-primary text-white px-1.5 py-0.5 rounded">
                                                    {it}
                                                </span>
                                            ))}
                                        </div>
                                        {msg.promotedRule.explanation && (
                                            <p className="text-[11px] text-secondary mt-1 italic break-words">
                                                "{msg.promotedRule.explanation}"
                                            </p>
                                        )}
                                        <p className="text-[10px] text-emerald-600 font-semibold mt-1 flex items-center justify-center gap-1">
                                            <ShieldCheck className="w-3 h-3" />
                                            <span>Pertanyaan berikutnya diuji dari memory bersih.</span>
                                        </p>
                                    </div>
                                )}
                            </div>
                        );
                    }

                    const isUser = msg.sender === 'user';
                    const sim = msg.simulation;

                    return (
                        <div 
                            key={msg.id} 
                            className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-full`}
                        >
                            <div className="flex items-end gap-2 max-w-[90%] sm:max-w-[78%]">
                                {!isUser && (
                                    <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center flex-shrink-0 mb-0.5">
                                        <Bot className="w-4 h-4" />
                                    </div>
                                )}

                                <div className={`
                                    rounded-2xl px-3.5 py-2 shadow-sm text-sm break-words
                                    ${isUser 
                                        ? 'bg-primary text-white rounded-tr-xs' 
                                        : 'bg-surface border border-surface-variant text-on-surface rounded-tl-xs'
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
                                <div className="mt-1.5 ml-9 max-w-[88%] sm:max-w-[76%] w-full bg-surface border border-primary/20 rounded-xl p-2.5 shadow-sm text-xs space-y-1.5">
                                    <div className="flex items-center justify-between border-b border-surface-variant pb-1">
                                        <div className="flex items-center gap-1 text-primary font-bold text-[11px]">
                                            <Sparkles className="w-3 h-3" />
                                            <span>Deteksi Intent</span>
                                        </div>
                                        <button
                                            onClick={() => handleOpenCorrection(msg)}
                                            className="flex items-center gap-1 text-[10px] font-bold text-primary hover:text-primary-dark bg-primary/10 hover:bg-primary/20 px-2 py-0.5 rounded-md transition-colors"
                                        >
                                            <RefreshCw className="w-2.5 h-2.5" />
                                            <span>Koreksi</span>
                                        </button>
                                    </div>

                                    {/* Chip Intents */}
                                    <div className="flex flex-wrap gap-1">
                                        {sim.intents.length > 0 ? (
                                            sim.intents.map((it, idx) => (
                                                <span 
                                                    key={idx} 
                                                    className="bg-primary/10 text-primary border border-primary/25 px-1.5 py-0.5 rounded font-mono text-[10px] font-semibold"
                                                >
                                                    {it.intent}
                                                </span>
                                            ))
                                        ) : (
                                            <span className="text-secondary italic text-[11px]">Tidak ada intent khusus (Chitchat)</span>
                                        )}
                                    </div>

                                    {/* Dampak Simulasi */}
                                    {sim.simulatedImpacts.length > 0 && (
                                        <div className="space-y-1 pt-0.5">
                                            {sim.simulatedImpacts.map((imp, idx) => (
                                                <div key={idx} className="bg-surface-container/60 rounded-lg p-1.5 border border-surface-variant">
                                                    <p className="font-semibold text-[11px] text-on-surface">{imp.type}: {imp.description}</p>
                                                    {imp.details && (
                                                        <p className="text-[10px] text-primary font-medium mt-0.5">{imp.details}</p>
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
                        <RefreshCw className="w-3 h-3 animate-spin text-primary" />
                        <span>Menganalisis pesan...</span>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* ── Fixed Bottom Dock (Suggestions & Input) ──────────────────────── */}
            <div className="flex-none bg-surface/95 backdrop-blur-md border-t border-surface-variant px-3 py-2 pb-3 md:pb-2.5 z-20">
                {/* Suggestions */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1.5 text-xs">
                    <span className="text-[10px] text-secondary font-medium whitespace-nowrap pl-0.5">Uji:</span>
                    {[
                        'Beli bensin 30k pakai SeaBank',
                        'A tuker cash 50k transfer ke BCA 50k',
                        'Nanti jam 4 sore ingetin kerjain tugas web',
                        'Cek saldo dan sisa tabungan'
                    ].map((prompt, idx) => (
                        <button
                            key={idx}
                            onClick={() => handleSendMessage(prompt)}
                            className="text-[10px] font-medium bg-surface-container hover:bg-surface-container-high border border-outline/10 text-secondary hover:text-on-surface rounded-full px-2.5 py-0.5 whitespace-nowrap transition-all active:scale-95 flex-shrink-0"
                        >
                            {prompt}
                        </button>
                    ))}
                </div>

                {/* Input Form */}
                <form 
                    onSubmit={(e) => {
                        e.preventDefault();
                        handleSendMessage();
                    }}
                    className="flex items-center gap-2"
                >
                    <input
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="Ketik instruksi chat di sini..."
                        className="flex-1 bg-surface-container border border-surface-variant/80 rounded-full px-4 py-2.5 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all shadow-inner"
                        disabled={isLoading}
                    />
                    <button
                        type="submit"
                        disabled={!inputText.trim() || isLoading}
                        className="w-10 h-10 rounded-full bg-primary text-white font-semibold flex items-center justify-center hover:bg-primary-dark transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md active:scale-95 flex-shrink-0"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </form>
            </div>

            {/* ── MODAL KOREKSI / LATIH KAREN ───────────────────────── */}
            {correctionTarget && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-surface border border-surface-variant rounded-2xl w-full max-w-lg p-5 shadow-2xl space-y-4 max-h-[90dvh] overflow-y-auto">
                        <div className="flex items-center justify-between border-b border-surface-variant pb-3">
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-primary" />
                                <div>
                                    <h3 className="font-bold text-on-surface text-base">Promote to Memory & Pelatihan</h3>
                                    <p className="text-[11px] text-secondary">Kunci aturan baru & reset ingatan sesi untuk pengujian murni</p>
                                </div>
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
                                className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-dark transition-all disabled:opacity-50 flex items-center gap-1.5 shadow-md active:scale-95"
                            >
                                {isSavingRule ? (
                                    <>
                                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                        <span>Memproses...</span>
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-3.5 h-3.5" />
                                        <span>Promote to Memory & Reset Sesi</span>
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
