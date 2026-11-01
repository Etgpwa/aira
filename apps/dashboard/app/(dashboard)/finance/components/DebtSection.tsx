'use client';

import { useState, useTransition } from 'react';
import { Clock, CheckCircle2, ChevronRight, Trash2, Loader2 } from 'lucide-react';
import AddDebtModal from './AddDebtModal';
import PayDebtModal from './PayDebtModal';
import { deletePersonDebts } from '../actions';

interface Debt {
    id: string;
    person_name: string;
    type: 'PAYABLE' | 'RECEIVABLE';
    amount: number;
    remaining_amount: number;
    description: string | null;
    status: string;
    created_at: string;
}

interface Account {
    id: string;
    name: string;
    balance: number;
    currency: string;
}

interface DebtSectionProps {
    debts: Debt[];
    accounts: Account[];
}

export default function DebtSection({ debts, accounts }: DebtSectionProps) {
    // Group debts by person_name
    const groupedDebts = (debts || []).reduce((acc, debt) => {
        const name = debt.person_name;
        if (!acc[name]) acc[name] = { personName: name, totalRemaining: 0, items: [] };
        acc[name].totalRemaining += Number(debt.remaining_amount);
        acc[name].items.push(debt);
        return acc;
    }, {} as Record<string, { personName: string; totalRemaining: number; items: Debt[] }>);

    const groupList = Object.values(groupedDebts).sort((a, b) => b.totalRemaining - a.totalRemaining);

    const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
    const [cachedDebts, setCachedDebts] = useState<Debt[]>([]);
    const [deletingPerson, setDeletingPerson] = useState<string | null>(null);
    const [isDeletingDirect, startDeleteDirectTransition] = useTransition();

    const handleSelectPerson = (group: { personName: string; items: Debt[] }) => {
        setSelectedPerson(group.personName);
        setCachedDebts(group.items);
    };

    const handleCloseModal = () => {
        setSelectedPerson(null);
        setCachedDebts([]);
    };

    const handleDeletePersonDirect = (e: React.MouseEvent, personName: string) => {
        e.stopPropagation();
        const isConfirmed = confirm(
            `Hapus seluruh catatan tagihan atas nama "${personName}" dari daftar?\n\nSemua data tagihan orang ini akan dihapus permanen tanpa transaksi kas.`
        );
        if (!isConfirmed) return;

        setDeletingPerson(personName);
        startDeleteDirectTransition(async () => {
            const res = await deletePersonDebts(personName);
            if (!res.success) {
                alert(res.error || 'Gagal menghapus data orang');
            }
            setDeletingPerson(null);
        });
    };

    // Ambil data items aktif atau gunakan cachedDebts saat status hutang sudah lunas (PAID)
    // agar modal receipt/struk tidak crash karena groupedDebts[selectedPerson] menjadi undefined setelah revalidasi server
    const activeDebts = selectedPerson
        ? (groupedDebts[selectedPerson]?.items || cachedDebts)
        : [];

    return (
        <section className="mb-6">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
                    <Clock className="w-5 h-5 text-primary" /> Hutang & Piutang
                </h3>
                <AddDebtModal accounts={accounts} />
            </div>

            <div className="flex flex-col gap-3">
                {groupList.map(group => {
                    // Check if it's mostly payable or receivable
                    const receivablesCount = group.items.filter(i => i.type === 'RECEIVABLE').length;
                    const payablesCount = group.items.filter(i => i.type === 'PAYABLE').length;
                    const mainType = receivablesCount > payablesCount ? 'RECEIVABLE' : 'PAYABLE';
                    const mainText = mainType === 'PAYABLE' ? 'Punya Hutang' : 'Punya Piutang';
                    const typeColor = mainType === 'PAYABLE' ? 'bg-peach-bg text-peach-fg' : 'bg-mint-bg text-mint-fg';

                    return (
                        <div 
                            key={group.personName} 
                            onClick={() => handleSelectPerson(group)}
                            className="bg-surface-bright p-4 rounded-[20px] border border-surface-variant shadow-[0_8px_24px_rgba(24,26,42,0.04)] flex justify-between items-center gap-4 cursor-pointer hover:border-primary/50 transition-colors"
                        >
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex-shrink-0 ${typeColor}`}>
                                        {group.items.length} Tagihan
                                    </span>
                                    <span className="text-sm font-bold text-on-surface truncate">{group.personName}</span>
                                </div>
                                <p className="text-xs text-secondary line-clamp-1">Klik untuk melihat detail atau lunasi</p>
                            </div>
                            <div className="text-right flex-shrink-0 flex items-center gap-1.5">
                                <div>
                                    <p className="font-bold text-on-surface tabular-nums mb-0.5">Rp {group.totalRemaining.toLocaleString('id-ID')}</p>
                                    <div className="flex items-center gap-1 justify-end text-primary text-xs font-bold">
                                        Kelola <ChevronRight className="w-3 h-3" />
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={(e) => handleDeletePersonDirect(e, group.personName)}
                                    disabled={deletingPerson === group.personName && isDeletingDirect}
                                    className="w-8 h-8 rounded-xl bg-surface-container hover:bg-red-50 hover:text-danger text-secondary flex items-center justify-center transition-colors ml-1"
                                    title={`Hapus seluruh tagihan ${group.personName} dari daftar`}
                                >
                                    {deletingPerson === group.personName && isDeletingDirect ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin text-danger" />
                                    ) : (
                                        <Trash2 className="w-3.5 h-3.5" />
                                    )}
                                </button>
                            </div>
                        </div>
                    );
                })}

                {groupList.length === 0 && (
                    <div className="bg-surface-bright p-5 rounded-[20px] border border-surface-variant text-center">
                        <CheckCircle2 className="w-8 h-8 text-mint-fg mx-auto mb-2" />
                        <p className="text-sm text-on-surface font-bold">Bebas Hutang</p>
                        <p className="text-xs text-secondary mt-1">Tidak ada hutang atau piutang aktif.</p>
                    </div>
                )}
            </div>

            {selectedPerson && (
                <PayDebtModal
                    personName={selectedPerson}
                    debts={activeDebts}
                    accounts={accounts}
                    onClose={handleCloseModal}
                />
            )}
        </section>
    );
}
