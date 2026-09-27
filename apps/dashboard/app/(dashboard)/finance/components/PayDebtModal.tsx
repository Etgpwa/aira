'use client';

import { useState, useTransition, useMemo } from 'react';
import { X, Loader2, Check, ArrowRight, Share2, Printer, CheckSquare, Square, ShieldAlert } from 'lucide-react';
import { payDebtManual, deleteDebtManual } from '../actions';
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

    // Delete state
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [password, setPassword] = useState('');
    const [isDeleting, startDeleteTransition] = useTransition();

    const [isPending, startTransition] = useTransition();
    const [errorMessage, setErrorMessage] = useState('');

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedDebtIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedDebtIds(newSet);
    };

    const totalSelected = useMemo(() => {
        return debts.filter(d => selectedDebtIds.has(d.id)).reduce((sum, d) => sum + Number(d.remaining_amount), 0);
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
                    totalTarget: totalSelected,
                    excessPayment: res.excessPayment,
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
            try {
                await deleteDebtManual(id, password);
                setDeleteId(null);
                setPassword('');
                // If it's the last debt, close modal
                if (debts.length <= 1) {
                    onClose();
                } else {
                    // Update selection
                    if (selectedDebtIds.has(id)) {
                        toggleSelection(id);
                    }
                }
            } catch (err: any) {
                setErrorMessage(err?.message || 'Gagal menghapus data. Password salah?');
            }
        });
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
                        <div className="mb-5">
                            <h2 className="text-xl font-extrabold text-on-surface">Detail Tagihan</h2>
                            <p className="text-sm font-bold text-primary mt-0.5">{personName}</p>
                        </div>

                        <div className="flex flex-col gap-3 mb-5 max-h-[40vh] overflow-y-auto pr-1">
                            {debts.map(debt => (
                                <div key={debt.id} className="relative bg-surface-bright rounded-[16px] border border-surface-variant p-3 flex flex-col gap-2 shrink-0">
                                    <div className="flex items-start gap-3">
                                        <button 
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
                                            <div className="flex flex-col gap-2 p-2 bg-red-50/50 rounded-lg">
                                                <p className="text-xs font-bold text-danger flex items-center gap-1"><ShieldAlert className="w-3 h-3"/> Konfirmasi Hapus</p>
                                                <input 
                                                    type="password" 
                                                    value={password}
                                                    onChange={e => setPassword(e.target.value)}
                                                    placeholder="Masukkan password login"
                                                    className="w-full text-xs px-3 py-2 rounded-lg bg-surface border border-danger/30 text-on-surface"
                                                />
                                                <div className="flex gap-2">
                                                    <button onClick={() => setDeleteId(null)} className="flex-1 py-1.5 text-xs font-bold text-secondary bg-surface-container rounded-lg">Batal</button>
                                                    <button onClick={() => handleDelete(debt.id)} disabled={isDeleting} className="flex-1 py-1.5 text-xs font-bold text-white bg-danger rounded-lg">{isDeleting ? 'Menghapus...' : 'Ya, Hapus'}</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex justify-end">
                                                <button onClick={() => setDeleteId(debt.id)} className="text-[10px] font-bold text-danger hover:underline">Hapus Data Ini</button>
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

                        {/* Struk Rincian (Printable) */}
                        <div id="receipt-card" className="w-full bg-surface-bright border border-surface-variant rounded-2xl p-5 text-left mb-6 relative overflow-hidden">
                            {/* Decorative dots */}
                            <div className="absolute top-0 left-0 w-full h-2 flex justify-around opacity-20">
                                {[...Array(20)].map((_, i) => <div key={i} className="w-1 h-1 rounded-full bg-on-surface"></div>)}
                            </div>
                            
                            <h3 className="text-center font-black text-on-surface uppercase tracking-widest text-sm mb-4 mt-2">KUITANSI PEMBAYARAN</h3>
                            
                            <div className="flex justify-between text-xs text-secondary mb-1">
                                <span>Tanggal</span>
                                <span>{receiptData.date}</span>
                            </div>
                            <div className="flex justify-between text-sm font-bold text-on-surface mb-4">
                                <span>Terkait</span>
                                <span>{receiptData.personName}</span>
                            </div>

                            <div className="border-t border-dashed border-surface-variant my-4"></div>

                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-secondary">Tagihan Dibayar</span>
                                <span className="font-bold">Rp {receiptData.totalTarget.toLocaleString('id-ID')}</span>
                            </div>
                            <div className="flex justify-between text-lg font-black text-primary mb-2">
                                <span>Uang Diterima/Keluar</span>
                                <span>Rp {receiptData.paidAmount.toLocaleString('id-ID')}</span>
                            </div>

                            {receiptData.isSettled && receiptData.excessPayment !== 0 && (
                                <div className="flex justify-between text-xs font-bold mt-3 p-2 bg-surface-container rounded-lg">
                                    <span>{receiptData.excessPayment > 0 ? 'Ekstra/Tip' : 'Selisih Diikhlaskan'}</span>
                                    <span className={receiptData.excessPayment > 0 ? 'text-mint-fg' : 'text-danger'}>
                                        Rp {Math.abs(receiptData.excessPayment).toLocaleString('id-ID')}
                                    </span>
                                </div>
                            )}

                             {!receiptData.isSettled && (receiptData.paidAmount - receiptData.totalTarget < 0) && (
                                <div className="flex justify-between text-xs font-bold mt-3 p-2 bg-peach-bg/30 text-peach-fg rounded-lg">
                                    <span>Sisa Tagihan Tertunggak</span>
                                    <span>Rp {Math.abs(receiptData.paidAmount - receiptData.totalTarget).toLocaleString('id-ID')}</span>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3 w-full">
                            <button 
                                onClick={() => {
                                    const text = `*KUITANSI PEMBAYARAN*\n\nTerkait: ${receiptData.personName}\nTanggal: ${receiptData.date}\nTotal Dibayar: Rp ${receiptData.paidAmount.toLocaleString('id-ID')}\n${receiptData.isSettled ? '(Sudah Dianggap Lunas)' : ''}\n\n_Dibuat otomatis dari Asisten Pribadi Karen_`;
                                    if (navigator.share) {
                                        navigator.share({ title: 'Kuitansi', text }).catch(() => {});
                                    } else {
                                        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`);
                                    }
                                }} 
                                className="flex-1 bg-surface-container text-on-surface py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
                            >
                                <Share2 className="w-4 h-4" /> Bagikan
                            </button>
                            <button onClick={onClose} className="flex-1 bg-primary text-on-primary py-3 rounded-xl font-bold text-sm">
                                Selesai
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
