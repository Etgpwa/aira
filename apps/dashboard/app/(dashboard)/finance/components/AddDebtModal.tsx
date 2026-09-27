'use client';

import { useState, useTransition } from 'react';
import { Plus, X, Loader2, Check, User, Wallet, ReceiptText, ArrowDownLeft, ArrowUpRight, HandCoins } from 'lucide-react';
import { recordDebtManual } from '../actions';

interface Account {
    id: string;
    name: string;
    balance: number;
    currency: string;
}

interface AddDebtModalProps {
    accounts: Account[];
}

export default function AddDebtModal({ accounts }: AddDebtModalProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [type, setType] = useState<'PAYABLE' | 'RECEIVABLE'>('RECEIVABLE');
    const [personName, setPersonName] = useState('');
    const [amount, setAmount] = useState('');
    const [accountId, setAccountId] = useState(accounts[0]?.id || '');
    const [description, setDescription] = useState('');
    const [noWalletImpact, setNoWalletImpact] = useState(false);

    const [isPending, startTransition] = useTransition();
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage('');
        setSuccessMessage('');

        const rawAmount = parseFloat(amount.replace(/[^0-9.-]+/g, ''));
        if (!rawAmount || rawAmount <= 0) {
            setErrorMessage('Nominal harus lebih dari 0');
            return;
        }

        if (!noWalletImpact && !accountId) {
            setErrorMessage('Pilih rekening sumber/tujuan');
            return;
        }

        startTransition(async () => {
            try {
                await recordDebtManual({
                    personName,
                    type,
                    amount: rawAmount,
                    accountId,
                    description: description.trim() || undefined,
                    noWalletImpact
                });

                setSuccessMessage('Catatan utang/piutang berhasil dibuat!');
                setTimeout(() => {
                    setIsOpen(false);
                    setAmount('');
                    setPersonName('');
                    setDescription('');
                    setNoWalletImpact(false);
                    setSuccessMessage('');
                }, 1000);
            } catch (err: any) {
                setErrorMessage(err?.message || 'Gagal mencatat data');
            }
        });
    };

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="h-10 px-4 rounded-full bg-surface-bright hover:bg-surface-container border border-surface-variant text-on-surface flex items-center justify-center transition-all active:scale-95 gap-2 text-sm font-bold shadow-sm"
                title="Catat Hutang/Piutang"
            >
                <HandCoins className="w-4 h-4 text-primary" /> Catat Hutang Baru
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
                    <div className="bg-surface w-full max-w-lg rounded-t-[28px] sm:rounded-[28px] p-6 pb-28 sm:pb-6 shadow-2xl max-h-[88dvh] overflow-y-auto border border-surface-variant flex flex-col">
                        <div className="flex justify-between items-center mb-5">
                            <div>
                                <h2 className="text-xl font-extrabold text-on-surface">Catat Hutang / Piutang</h2>
                                <p className="text-xs text-secondary mt-0.5">Catat utang atau piutang secara manual</p>
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-secondary hover:text-on-surface"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                            {/* Toggle Tipe */}
                            <div className="flex bg-surface-container p-1 rounded-2xl">
                                <button
                                    type="button"
                                    onClick={() => setType('RECEIVABLE')}
                                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${type === 'RECEIVABLE' ? 'bg-mint-bg text-mint-fg shadow-sm' : 'text-secondary hover:text-on-surface'}`}
                                >
                                    <ArrowUpRight className="w-4 h-4" /> Piutang (Meminjamkan)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setType('PAYABLE')}
                                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${type === 'PAYABLE' ? 'bg-peach-bg text-peach-fg shadow-sm' : 'text-secondary hover:text-on-surface'}`}
                                >
                                    <ArrowDownLeft className="w-4 h-4" /> Hutang (Meminjam)
                                </button>
                            </div>

                            {/* Nama Pihak */}
                            <div>
                                <label className="text-xs font-bold text-secondary mb-1.5 flex items-center gap-1.5">
                                    <User className="w-3.5 h-3.5 text-primary" /> Nama Pihak Terkait *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={personName}
                                    onChange={(e) => setPersonName(e.target.value)}
                                    placeholder="Nama teman, kerabat, dll"
                                    className="w-full bg-surface-container border border-surface-variant rounded-xl px-4 py-3 text-on-surface text-sm font-bold focus:outline-none focus:border-primary"
                                />
                            </div>

                            {/* Nominal */}
                            <div>
                                <label className="text-xs font-bold text-secondary mb-1.5 block">Nominal (Rp) *</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-secondary text-sm">Rp</span>
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        step="any"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        placeholder="50.000"
                                        className="w-full bg-surface-container border border-surface-variant rounded-xl pl-12 pr-4 py-3 text-on-surface text-base font-extrabold focus:outline-none focus:border-primary tabular-nums"
                                    />
                                </div>
                            </div>

                            {/* Checkbox Wallet Impact */}
                            <label className="flex items-start gap-3 p-3 bg-surface-bright rounded-xl border border-surface-variant cursor-pointer group">
                                <div className="relative flex items-center justify-center mt-0.5">
                                    <input 
                                        type="checkbox" 
                                        checked={noWalletImpact}
                                        onChange={(e) => setNoWalletImpact(e.target.checked)}
                                        className="appearance-none w-5 h-5 border-2 border-secondary rounded checked:bg-primary checked:border-primary transition-colors cursor-pointer"
                                    />
                                    {noWalletImpact && <Check className="w-3 h-3 text-on-primary absolute pointer-events-none" />}
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-bold text-on-surface group-hover:text-primary transition-colors">Hanya Catatan Administratif</p>
                                    <p className="text-xs text-secondary mt-0.5 leading-relaxed">Jangan kurangi/tambah saldo dompet (gunakan jika uang sudah tercatat terpisah atau murni via tunai tanpa di sistem).</p>
                                </div>
                            </label>

                            {/* Pilih Rekening (Disabled jika noWalletImpact) */}
                            <div className={`transition-opacity ${noWalletImpact ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
                                <label className="text-xs font-bold text-secondary mb-1.5 flex items-center gap-1.5">
                                    <Wallet className="w-3.5 h-3.5 text-primary" /> {type === 'RECEIVABLE' ? 'Sumber Dana (Uang Keluar)' : 'Tujuan Dana (Uang Masuk)'} *
                                </label>
                                <select
                                    required={!noWalletImpact}
                                    value={accountId}
                                    onChange={(e) => setAccountId(e.target.value)}
                                    className="w-full bg-surface-container border border-surface-variant rounded-xl px-4 py-3 text-on-surface text-sm font-semibold focus:outline-none focus:border-primary"
                                >
                                    {accounts.map(acc => (
                                        <option key={acc.id} value={acc.id}>
                                            {acc.name} — (Saldo: Rp{Number(acc.balance).toLocaleString('id-ID')})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Deskripsi */}
                            <div>
                                <label className="text-xs font-bold text-secondary mb-1.5 flex items-center gap-1.5">
                                    <ReceiptText className="w-3.5 h-3.5 text-primary" /> Keterangan
                                </label>
                                <input
                                    type="text"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Contoh: Pinjam buat beli pentol"
                                    className="w-full bg-surface-container border border-surface-variant rounded-xl px-4 py-3 text-on-surface text-sm focus:outline-none focus:border-primary"
                                />
                            </div>

                            {/* Feedback */}
                            {successMessage && (
                                <div className="p-3 bg-mint-bg/30 text-mint-fg rounded-xl text-xs font-bold flex items-center gap-2">
                                    <Check className="w-4 h-4" /> {successMessage}
                                </div>
                            )}
                            {errorMessage && (
                                <div className="p-3 bg-red-50 text-danger rounded-xl text-xs font-bold">
                                    {errorMessage}
                                </div>
                            )}

                            {/* Submit */}
                            <div className="flex gap-3 mt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsOpen(false)}
                                    className="flex-1 bg-surface-container hover:bg-surface-container-high text-secondary py-3 rounded-full font-bold text-sm"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={isPending}
                                    className="flex-1 bg-primary hover:bg-primary-container text-on-primary py-3 rounded-full font-bold text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(56,74,216,0.25)]"
                                >
                                    {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> Simpan Data</>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
