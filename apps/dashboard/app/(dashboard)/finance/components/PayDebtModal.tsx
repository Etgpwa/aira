'use client';

import { useState, useTransition, useMemo } from 'react';
import { X, Loader2, Check, ArrowRight, Share2, Printer, CheckSquare, Square, ShieldAlert, Trash2 } from 'lucide-react';
import { payDebtManual, deleteDebtManual, deletePersonDebts } from '../actions';
import PuzzleSlider from './PuzzleSlider';

interface Debt {
    id: string;
    type: 'PAYABLE' | 'RECEIVABLE';
    amount: number;
    remaining_amount: number;
    description: string | null;
    created_at: string;
}

interface Account {
    id: string;
    name: string;
    balance: number;
    currency: string;
}

interface PayDebtModalProps {
    personName: string;
    debts: Debt[];
    accounts: Account[];
    onClose: () => void;
}

export default function PayDebtModal({ personName, debts, accounts, onClose }: PayDebtModalProps) {
    // Selection state
    const [selectedDebtIds, setSelectedDebtIds] = useState<Set<string>>(new Set());
    
    // Payment state
    const [amount, setAmount] = useState('');
    const [accountId, setAccountId] = useState(accounts[0]?.id || '');
    const [isSettled, setIsSettled] = useState(false);
    
    // UI state
    const [step, setStep] = useState<'SELECT' | 'CONFIRM' | 'SUCCESS'>('SELECT');
    const [isVerified, setIsVerified] = useState(false);
    const [receiptData, setReceiptData] = useState<any>(null);
    const [isSharing, setIsSharing] = useState(false);

    // Delete state
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [isDeleting, startDeleteTransition] = useTransition();
    const [isDeletingPerson, startDeletePersonTransition] = useTransition();

    const [isPending, startTransition] = useTransition();
    const [errorMessage, setErrorMessage] = useState('');

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedDebtIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedDebtIds(newSet);
    };

    const totalSelected = useMemo(() => {
        return (debts || []).filter(d => selectedDebtIds.has(d.id)).reduce((sum, d) => sum + Number(d.remaining_amount), 0);
    }, [debts, selectedDebtIds]);

    const handleNext = () => {
        if (selectedDebtIds.size === 0) {
            setErrorMessage('Pilih minimal satu utang/piutang untuk dilunasi');
            return;
        }
        const rawAmount = parseFloat(amount.replace(/[^0-9.-]+/g, ''));
        if (!rawAmount || rawAmount <= 0) {
            setErrorMessage('Nominal pembayaran harus lebih dari 0');
            return;
        }
        if (!accountId) {
            setErrorMessage('Pilih rekening tujuan');
            return;
        }
        
        setErrorMessage('');
        setStep('CONFIRM');
    };

    const handleSubmit = async () => {
        const rawAmount = parseFloat(amount.replace(/[^0-9.-]+/g, ''));
        const targetAmountToPay = totalSelected;
        setErrorMessage('');
        
        startTransition(async () => {
            try {
                const res = await payDebtManual({
                    personName,
                    debtIds: Array.from(selectedDebtIds),
                    amount: rawAmount,
                    accountId,
                    isSettled
                });

                setReceiptData({
                    personName,
                    paidAmount: rawAmount,
                    totalTarget: targetAmountToPay,
                    excessPayment: res?.excessPayment || 0,
                    isSettled,
                    date: new Date().toLocaleString('id-ID')
                });
                setStep('SUCCESS');
            } catch (err: any) {
                setErrorMessage(err?.message || 'Gagal memproses pembayaran');
            }
        });
    };

    const handleDelete = (id: string) => {
        setErrorMessage('');
        startDeleteTransition(async () => {
            const res = await deleteDebtManual(id);
            if (!res.success) {
                setErrorMessage(res.error || 'Gagal menghapus data.');
                return;
            }
            setDeleteId(null);
            // If it's the last debt, close modal
            if ((debts || []).length <= 1) {
                onClose();
            } else {
                // Update selection
                if (selectedDebtIds.has(id)) {
                    toggleSelection(id);
                }
            }
        });
    };

    const handleDeletePerson = () => {
        const isConfirmed = confirm(
            `Hapus seluruh catatan tagihan atas nama "${personName}" dari daftar?\n\nSemua data tagihan orang ini akan dihapus permanen tanpa memotong atau menambah saldo kas.`
        );
        if (!isConfirmed) return;

        setErrorMessage('');
        startDeletePersonTransition(async () => {
            const res = await deletePersonDebts(personName);
            if (!res.success) {
                setErrorMessage(res.error || 'Gagal menghapus data orang');
                return;
            }
            onClose();
        });
    };

    const handleShare = async () => {
        if (!receiptData || isSharing) return;

        setIsSharing(true);
        const text = `*KUITANSI PEMBAYARAN*\n\nTerkait: ${receiptData.personName}\nTanggal: ${receiptData.date}\nTotal Dibayar: Rp ${Number(receiptData.paidAmount || 0).toLocaleString('id-ID')}\n${receiptData.isSettled ? '(Status: Sudah Dianggap Lunas)' : ''}\n\n_Dibuat otomatis dari Asisten Pribadi Karen_`;

        try {
            const cardEl = document.getElementById('receipt-card');
            if (!cardEl) throw new Error('Receipt card element not found');

            // Import html2canvas dynamically
            const html2canvas = (await import('html2canvas')).default;

            const canvas = await html2canvas(cardEl, {
                scale: 3, // Skala 3x agar teks tajam dan tidak pecah saat dikirim ke WA
                backgroundColor: '#ffffff',
                useCORS: true,
                logging: false,
            });

            const blob = await new Promise<Blob | null>((resolve) => 
                canvas.toBlob(resolve, 'image/png')
            );

            if (!blob) throw new Error('Gagal mengonversi gambar');

            const fileName = `Kuitansi_${receiptData.personName.replace(/\s+/g, '_')}.png`;
            const file = new File([blob], fileName, { type: 'image/png' });

            // Cek apakah peramban mendukung share berkas (Web Share API Level 2 pada Android & iOS)
            if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: 'Kuitansi Pembayaran',
                    text: text,
                });
            } else if (typeof navigator !== 'undefined' && navigator.share) {
                // Fallback jika browser HP hanya support share text: unduh gambar lalu bagikan teks
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

                await navigator.share({
                    title: 'Kuitansi Pembayaran',
                    text: `${text}\n\n(File gambar kuitansi telah tersimpan di perangkat Anda)`,
                });
            } else {
                // Fallback untuk desktop PC: download gambar dan buka WhatsApp Web
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

                if (typeof window !== 'undefined') {
                    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`);
                }
            }
        } catch (err: any) {
            console.error('Error sharing image receipt:', err);
            // Fallback teks jika ada error pada canvas
            if (typeof navigator !== 'undefined' && navigator.share) {
                await navigator.share({ title: 'Kuitansi Pembayaran', text }).catch(() => {});
            } else if (typeof window !== 'undefined') {
                window.open(`https://wa.me/?text=${encodeURIComponent(text)}`);
            }
        } finally {
            setIsSharing(false);
        }
    };

    const needsCaptcha = isSettled && totalSelected > 0 && parseFloat(amount.replace(/[^0-9.-]+/g, '') || '0') !== totalSelected;
    const rawAmount = parseFloat(amount.replace(/[^0-9.-]+/g, '') || '0');
    const difference = rawAmount - totalSelected;

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
            <div className="bg-surface w-full max-w-lg rounded-t-[28px] sm:rounded-[28px] p-6 pb-28 sm:pb-6 shadow-2xl max-h-[88dvh] overflow-y-auto border border-surface-variant flex flex-col relative">
                <button onClick={onClose} className="absolute top-6 right-6 w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-secondary hover:text-on-surface">
                    <X className="w-4 h-4" />
                </button>

                {step === 'SELECT' && (
                    <>
                        <div className="mb-5 pr-10 flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-extrabold text-on-surface">Detail Tagihan</h2>
                                <p className="text-sm font-bold text-primary mt-0.5">{personName}</p>
                            </div>
                            <button
                                type="button"
                                onClick={handleDeletePerson}
                                disabled={isDeletingPerson}
                                className="text-xs font-bold text-danger bg-red-50 hover:bg-red-100 border border-red-200/60 px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-all active:scale-95 shadow-sm"
                                title={`Hapus seluruh tagihan ${personName} dari daftar`}
                            >
                                {isDeletingPerson ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                <span>Hapus Orang</span>
                            </button>
                        </div>

                        <div className="flex flex-col gap-3 mb-5 max-h-[40vh] overflow-y-auto pr-1">
                            {(debts || []).map(debt => (
                                <div key={debt.id} className="relative bg-surface-bright rounded-[16px] border border-surface-variant p-3 flex flex-col gap-2 shrink-0">
                                    <div className="flex items-start gap-3">
                                        <button 
                                            type="button"
                                            onClick={() => toggleSelection(debt.id)}
                                            className="mt-1 flex-shrink-0 text-primary"
                                        >
                                            {selectedDebtIds.has(debt.id) ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5 text-secondary" />}
                                        </button>
                                        <div className="flex-1 min-w-0" onClick={() => toggleSelection(debt.id)}>
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${debt.type === 'PAYABLE' ? 'bg-peach-bg text-peach-fg' : 'bg-mint-bg text-mint-fg'}`}>
                                                        {debt.type === 'PAYABLE' ? 'Hutangku' : 'Piutangku'}
                                                    </span>
                                                    <p className="text-sm font-bold text-on-surface mt-1">Rp {Number(debt.remaining_amount).toLocaleString('id-ID')}</p>
                                                </div>
                                            </div>
                                            <p className="text-xs text-secondary mt-1 line-clamp-1">{debt.description || 'Tanpa catatan'}</p>
                                        </div>
                                    </div>
                                    
                                    {/* Hapus Button & Form */}
                                    <div className="mt-2 pt-2 border-t border-surface-variant flex flex-col gap-2">
                                        {deleteId === debt.id ? (
                                            <div className="flex flex-col gap-2 p-2.5 bg-red-50/70 border border-danger/20 rounded-xl">
                                                <p className="text-xs font-bold text-danger flex items-center gap-1.5">
                                                    <ShieldAlert className="w-3.5 h-3.5"/> Hapus tagihan ini?
                                                </p>
                                                <p className="text-[11px] text-secondary">
                                                    Catatan akan dihapus permanen dari daftar tanpa transaksi kas.
                                                </p>
                                                <div className="flex gap-2 mt-1">
                                                    <button 
                                                        type="button"
                                                        onClick={() => setDeleteId(null)} 
                                                        className="flex-1 py-1.5 text-xs font-bold text-secondary bg-surface-container rounded-lg"
                                                    >
                                                        Batal
                                                    </button>
                                                    <button 
                                                        type="button"
                                                        onClick={() => handleDelete(debt.id)} 
                                                        disabled={isDeleting} 
                                                        className="flex-1 py-1.5 text-xs font-bold text-white bg-danger rounded-lg flex items-center justify-center gap-1 shadow-sm"
                                                    >
                                                        {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Ya, Hapus'}
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex justify-end">
                                                <button 
                                                    type="button"
                                                    onClick={() => setDeleteId(debt.id)} 
                                                    className="text-[11px] font-bold text-danger hover:underline flex items-center gap-1"
                                                >
                                                    <Trash2 className="w-3 h-3" /> Hapus Tagihan Ini
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="bg-surface-container rounded-xl p-4 flex flex-col gap-4 mb-4">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-bold text-secondary">Total Terpilih</span>
                                <span className="text-lg font-extrabold text-on-surface">Rp {totalSelected.toLocaleString('id-ID')}</span>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-secondary mb-1.5 block">Nominal Pembayaran *</label>
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder="Contoh: 50000"
                                    className="w-full bg-surface border border-surface-variant rounded-xl px-4 py-3 text-on-surface text-base font-extrabold focus:border-primary"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-secondary mb-1.5 block">Rekening *</label>
                                <select
                                    value={accountId}
                                    onChange={(e) => setAccountId(e.target.value)}
                                    className="w-full bg-surface border border-surface-variant rounded-xl px-4 py-3 text-on-surface text-sm font-semibold focus:border-primary"
                                >
                                    {accounts.map(acc => (
                                        <option key={acc.id} value={acc.id}>{acc.name}</option>
                                    ))}
                                </select>
                            </div>

                            <label className="flex items-start gap-2 mt-2 cursor-pointer group">
                                <div className="relative flex items-center justify-center mt-0.5">
                                    <input 
                                        type="checkbox" 
                                        checked={isSettled}
                                        onChange={(e) => setIsSettled(e.target.checked)}
                                        className="appearance-none w-5 h-5 border-2 border-secondary rounded checked:bg-primary checked:border-primary transition-colors cursor-pointer"
                                    />
                                    {isSettled && <Check className="w-3 h-3 text-on-primary absolute pointer-events-none" />}
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-bold text-on-surface">Anggap Lunas (Settle)</p>
                                    <p className="text-[10px] text-secondary mt-0.5">Jika dicentang, selisih kurang akan diikhlaskan, dan selisih lebih akan jadi tip.</p>
                                </div>
                            </label>
                        </div>

                        {errorMessage && <p className="text-xs text-danger font-bold text-center mb-4">{errorMessage}</p>}

                        <button
                            onClick={handleNext}
                            className="w-full bg-primary text-on-primary py-3.5 rounded-full font-bold text-sm transition-all active:scale-[0.98] shadow-md"
                        >
                            Lanjut Konfirmasi
                        </button>
                    </>
                )}

                {step === 'CONFIRM' && (
                    <div className="flex flex-col gap-5 pt-4">
                        <h2 className="text-xl font-extrabold text-on-surface text-center">Konfirmasi Transaksi</h2>
                        
                        <div className="bg-surface-container rounded-xl p-5 text-center">
                            <p className="text-sm text-secondary mb-1">Total Tagihan Terpilih</p>
                            <p className="text-xl font-extrabold text-on-surface mb-4">Rp {totalSelected.toLocaleString('id-ID')}</p>
                            
                            <p className="text-sm text-secondary mb-1">Dibayarkan</p>
                            <p className="text-2xl font-black text-primary">Rp {rawAmount.toLocaleString('id-ID')}</p>
                        </div>

                        {isSettled && difference !== 0 && (
                            <div className={`p-4 rounded-xl border ${difference < 0 ? 'bg-peach-bg/30 border-peach-fg/30' : 'bg-mint-bg/30 border-mint-fg/30'}`}>
                                <p className="text-sm font-bold text-center">
                                    {difference < 0 
                                        ? `Kurang Rp ${Math.abs(difference).toLocaleString('id-ID')} akan diikhlaskan (dihapus).` 
                                        : `Lebih Rp ${difference.toLocaleString('id-ID')} akan menjadi uang masuk ekstra (Tip).`}
                                </p>
                            </div>
                        )}

                        {!isSettled && difference < 0 && (
                            <div className="p-4 rounded-xl border bg-surface-bright border-surface-variant text-center">
                                <p className="text-sm font-bold">Sisa tagihan Rp {Math.abs(difference).toLocaleString('id-ID')} akan tetap tercatat.</p>
                            </div>
                        )}

                        {errorMessage && <p className="text-xs text-danger font-bold text-center">{errorMessage}</p>}

                        {needsCaptcha ? (
                            <div className="mt-2">
                                <p className="text-xs text-secondary font-bold text-center mb-3">Mohon selesaikan puzzle ini untuk melanjutkan penyelesaian (settlement) tagihan.</p>
                                <PuzzleSlider onSuccess={() => setIsVerified(true)} />
                            </div>
                        ) : null}

                        <div className="flex gap-3 mt-4">
                            <button onClick={() => setStep('SELECT')} className="flex-1 bg-surface-container text-secondary py-3.5 rounded-full font-bold text-sm">Kembali</button>
                            <button
                                onClick={handleSubmit}
                                disabled={isPending || (needsCaptcha && !isVerified)}
                                className="flex-1 bg-primary text-on-primary py-3.5 rounded-full font-bold text-sm transition-all shadow-md flex items-center justify-center disabled:opacity-50"
                            >
                                {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Proses Sekarang'}
                            </button>
                        </div>
                    </div>
                )}

                {step === 'SUCCESS' && receiptData && (
                    <div className="flex flex-col items-center pt-8 pb-4 text-center">
                        <div className="w-16 h-16 bg-mint-bg text-mint-fg rounded-full flex items-center justify-center mb-4 shadow-lg">
                            <Check className="w-8 h-8" strokeWidth={3} />
                        </div>
                        <h2 className="text-2xl font-extrabold text-on-surface mb-2">Berhasil!</h2>
                        <p className="text-secondary text-sm mb-6">Pembayaran telah dicatat ke sistem.</p>

                        {/* Struk Rincian (Printable & Exportable to Image) */}
                        <div id="receipt-card" className="w-full bg-white border border-surface-variant rounded-2xl p-5 sm:p-6 text-left mb-6 relative overflow-hidden shadow-sm">
                            {/* Decorative dots */}
                            <div className="absolute top-0 left-0 w-full h-2 flex justify-around opacity-20">
                                {[...Array(20)].map((_, i) => <div key={i} className="w-1 h-1 rounded-full bg-on-surface"></div>)}
                            </div>
                            
                            <div className="text-center mb-4 mt-1">
                                <span className="inline-block px-3 py-0.5 bg-mint-bg text-mint-fg text-[10px] font-bold rounded-full uppercase tracking-wider mb-2">
                                    Lunas / Terverifikasi
                                </span>
                                <h3 className="font-black text-on-surface uppercase tracking-widest text-sm sm:text-base">KUITANSI PEMBAYARAN</h3>
                                <p className="text-[10px] text-secondary font-medium mt-0.5">Asisten Pribadi Karen</p>
                            </div>
                            
                            <div className="flex justify-between text-xs text-secondary mb-1.5">
                                <span>Tanggal</span>
                                <span className="font-bold text-on-surface">{receiptData.date}</span>
                            </div>
                            <div className="flex justify-between text-sm font-bold text-on-surface mb-3">
                                <span>Terkait</span>
                                <span className="text-primary font-black">{receiptData.personName}</span>
                            </div>

                            <div className="border-t border-dashed border-surface-variant my-3"></div>

                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-secondary font-medium">Tagihan Dibayar</span>
                                <span className="font-bold text-on-surface">Rp {Number(receiptData.totalTarget || 0).toLocaleString('id-ID')}</span>
                            </div>
                            <div className="flex justify-between text-lg font-black text-primary mb-2">
                                <span>Uang Diterima/Keluar</span>
                                <span>Rp {Number(receiptData.paidAmount || 0).toLocaleString('id-ID')}</span>
                            </div>

                            {receiptData.isSettled && (receiptData.excessPayment || 0) !== 0 && (
                                <div className="flex justify-between text-xs font-bold mt-2.5 p-2.5 bg-surface-container rounded-xl">
                                    <span>{(receiptData.excessPayment || 0) > 0 ? 'Ekstra/Tip' : 'Selisih Diikhlaskan'}</span>
                                    <span className={(receiptData.excessPayment || 0) > 0 ? 'text-mint-fg' : 'text-danger'}>
                                        Rp {Math.abs(receiptData.excessPayment || 0).toLocaleString('id-ID')}
                                    </span>
                                </div>
                            )}

                             {!receiptData.isSettled && (Number(receiptData.paidAmount || 0) - Number(receiptData.totalTarget || 0) < 0) && (
                                <div className="flex justify-between text-xs font-bold mt-2.5 p-2.5 bg-peach-bg/30 text-peach-fg rounded-xl">
                                    <span>Sisa Tagihan Tertunggak</span>
                                    <span>Rp {Math.abs(Number(receiptData.paidAmount || 0) - Number(receiptData.totalTarget || 0)).toLocaleString('id-ID')}</span>
                                </div>
                            )}

                            <div className="border-t border-dashed border-surface-variant mt-4 pt-2.5 text-center">
                                <p className="text-[10px] text-secondary font-medium italic">
                                    Bukti pembayaran sah tercatat di sistem Karen
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3 w-full">
                            <button 
                                type="button"
                                onClick={handleShare}
                                disabled={isSharing}
                                className="flex-1 bg-surface-container hover:bg-surface-container-high text-on-surface py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                            >
                                {isSharing ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                        <span>Menyiapkan Gambar...</span>
                                    </>
                                ) : (
                                    <>
                                        <Share2 className="w-4 h-4 text-primary" />
                                        <span>Bagikan</span>
                                    </>
                                )}
                            </button>
                            <button 
                                type="button"
                                onClick={onClose} 
                                className="flex-1 bg-primary text-on-primary py-3.5 rounded-xl font-bold text-sm transition-all active:scale-[0.98] shadow-md"
                            >
                                Selesai
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
