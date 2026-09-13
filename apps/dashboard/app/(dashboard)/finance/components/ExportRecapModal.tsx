'use client';

import { useState } from 'react';
import { Download, FileSpreadsheet, FileText, X, Loader2, Calendar, Wallet, CheckCircle2, AlertCircle } from 'lucide-react';
import { getMonthlyFinanceRecap } from '../actions';

interface Account {
    id: string;
    name: string;
    balance?: number;
}

interface ExportRecapModalProps {
    accounts: Account[];
}

const MONTHS = [
    { value: 1, label: 'Januari' },
    { value: 2, label: 'Februari' },
    { value: 3, label: 'Maret' },
    { value: 4, label: 'April' },
    { value: 5, label: 'Mei' },
    { value: 6, label: 'Juni' },
    { value: 7, label: 'Juli' },
    { value: 8, label: 'Agustus' },
    { value: 9, label: 'September' },
    { value: 10, label: 'Oktober' },
    { value: 11, label: 'November' },
    { value: 12, label: 'Desember' }
];

export default function ExportRecapModal({ accounts }: ExportRecapModalProps) {
    const [isOpen, setIsOpen] = useState(false);
    
    const now = new Date();
    const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
    const [selectedAccountId, setSelectedAccountId] = useState<string>('all');

    const [isLoadingExcel, setIsLoadingExcel] = useState(false);
    const [isLoadingPDF, setIsLoadingPDF] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

    const handleExport = async (formatType: 'excel' | 'pdf') => {
        setStatusMessage(null);
        if (formatType === 'excel') setIsLoadingExcel(true);
        else setIsLoadingPDF(true);

        try {
            const data = await getMonthlyFinanceRecap(selectedMonth, selectedYear, selectedAccountId);

            if (!data.transactions || data.transactions.length === 0) {
                setStatusMessage({
                    type: 'error',
                    text: `Tidak ada data transaksi pada ${MONTHS[selectedMonth - 1].label} ${selectedYear}.`
                });
                return;
            }

            const chosenAccount = accounts.find(a => a.id === selectedAccountId);
            const accountName = chosenAccount ? chosenAccount.name : 'Semua Rekening';

            const exportPayload = {
                month: selectedMonth,
                year: selectedYear,
                accountName,
                transactions: data.transactions as any,
                userEmail: data.userEmail,
                userSettings: data.userSettings
            };

            if (formatType === 'excel') {
                const { generateFinanceExcel } = await import('../utils/exportUtils');
                await generateFinanceExcel(exportPayload);
                setStatusMessage({
                    type: 'success',
                    text: `File Excel (${data.transactions.length} transaksi) berhasil diunduh!`
                });
            } else {
                const { generateFinanceJournalPDF } = await import('../utils/exportUtils');
                generateFinanceJournalPDF(exportPayload);
                setStatusMessage({
                    type: 'success',
                    text: `Dokumen PDF Jurnal (${data.transactions.length} transaksi) berhasil dibuat!`
                });
            }
        } catch (err: any) {
            console.error('Export error:', err);
            const rawMsg = err?.message || err?.error_description || (typeof err === 'string' ? err : 'Gagal mengekspor rekap bulanan.');
            const cleanMsg = typeof rawMsg === 'object' ? JSON.stringify(rawMsg) : String(rawMsg);
            setStatusMessage({
                type: 'error',
                text: cleanMsg
            });
        } finally {
            setIsLoadingExcel(false);
            setIsLoadingPDF(false);
        }
    };

    return (
        <>
            {/* Trigger Button */}
            <button
                type="button"
                onClick={() => {
                    setStatusMessage(null);
                    setIsOpen(true);
                }}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold bg-surface-container-high hover:bg-surface-container-highest text-on-surface border border-outline/20 shadow-sm transition active:scale-95"
            >
                <Download className="w-4 h-4 text-primary" />
                <span>Export Rekap</span>
            </button>

            {/* Modal Dialog */}
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-surface rounded-2xl w-full max-w-md border border-outline/20 shadow-2xl overflow-hidden animate-scale-up">
                        
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-outline/10">
                            <div>
                                <h3 className="text-lg font-bold text-on-surface">Export Rekap Bulanan</h3>
                                <p className="text-xs text-secondary mt-0.5">Unduh data keuangan dalam format Excel atau PDF Jurnal</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="p-1.5 rounded-lg text-secondary hover:text-on-surface hover:bg-surface-container-highest transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Form Content */}
                        <div className="p-6 space-y-4">
                            
                            {/* Filter Bulan & Tahun */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-secondary mb-1.5 flex items-center gap-1.5">
                                        <Calendar className="w-3.5 h-3.5" /> Bulan
                                    </label>
                                    <select
                                        value={selectedMonth}
                                        onChange={(e) => setSelectedMonth(Number(e.target.value))}
                                        className="w-full px-3 py-2.5 rounded-xl bg-surface-container text-sm font-medium border border-outline/20 focus:outline-none focus:ring-2 focus:ring-primary/40 text-on-surface"
                                    >
                                        {MONTHS.map(m => (
                                            <option key={m.value} value={m.value}>{m.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-secondary mb-1.5 flex items-center gap-1.5">
                                        <Calendar className="w-3.5 h-3.5" /> Tahun
                                    </label>
                                    <select
                                        value={selectedYear}
                                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                                        className="w-full px-3 py-2.5 rounded-xl bg-surface-container text-sm font-medium border border-outline/20 focus:outline-none focus:ring-2 focus:ring-primary/40 text-on-surface"
                                    >
                                        {[selectedYear - 1, selectedYear, selectedYear + 1].map(y => (
                                            <option key={y} value={y}>{y}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Filter Rekening / Dompet */}
                            <div>
                                <label className="block text-xs font-semibold text-secondary mb-1.5 flex items-center gap-1.5">
                                    <Wallet className="w-3.5 h-3.5" /> Rekening / Dompet
                                </label>
                                <select
                                    value={selectedAccountId}
                                    onChange={(e) => setSelectedAccountId(e.target.value)}
                                    className="w-full px-3 py-2.5 rounded-xl bg-surface-container text-sm font-medium border border-outline/20 focus:outline-none focus:ring-2 focus:ring-primary/40 text-on-surface"
                                >
                                    <option value="all">Semua Rekening & Dompet</option>
                                    {accounts.map(acc => (
                                        <option key={acc.id} value={acc.id}>{acc.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Status Message */}
                            {statusMessage && (
                                <div className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
                                    statusMessage.type === 'success' 
                                        ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                        : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                                }`}>
                                    {statusMessage.type === 'success' ? (
                                        <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                                    ) : (
                                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                    )}
                                    <span>{statusMessage.text}</span>
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                
                                {/* Tombol Download Excel */}
                                <button
                                    type="button"
                                    disabled={isLoadingExcel || isLoadingPDF}
                                    onClick={() => handleExport('excel')}
                                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                                >
                                    {isLoadingExcel ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <FileSpreadsheet className="w-4 h-4" />
                                    )}
                                    <span>Excel (.xlsx)</span>
                                </button>

                                {/* Tombol Download PDF Jurnal */}
                                <button
                                    type="button"
                                    disabled={isLoadingExcel || isLoadingPDF}
                                    onClick={() => handleExport('pdf')}
                                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                                >
                                    {isLoadingPDF ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <FileText className="w-4 h-4" />
                                    )}
                                    <span>PDF Jurnal</span>
                                </button>
                            </div>

                            <p className="text-[11px] text-center text-secondary/70">
                                File PDF berisi format jurnal arus kas akuntansi debit-kredit siap cetak.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
