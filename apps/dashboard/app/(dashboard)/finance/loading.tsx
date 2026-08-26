
function SkeletonRow() {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ flex: 1 }}>
                <div className="skeleton sk-text" style={{ width: '60%', marginBottom: '0.4rem' }} />
                <div className="skeleton sk-text-sm" style={{ width: '40%' }} />
            </div>
            <div className="skeleton sk-text" style={{ width: '80px' }} />
        </div>
    );
}

function SkeletonBudget() {
    return (
        <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <div className="skeleton sk-text-sm" style={{ width: '40%' }} />
                <div className="skeleton sk-text-sm" style={{ width: '30%' }} />
            </div>
            <div className="skeleton sk-progress" style={{ width: '100%' }} />
        </div>
    );
}

export default function FinanceLoading() {
    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div className="skeleton sk-text-2xl" style={{ width: '120px' }} />
                <div className="skeleton sk-btn" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
                {/* Kolom Kiri */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {/* Rekening */}
                    <div className="sk-card">
                        <div className="skeleton sk-text-lg" style={{ width: '140px', marginBottom: '1rem' }} />
                        {[1, 2].map(i => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0', borderBottom: '1px solid var(--border-color)' }}>
                                <div className="skeleton sk-text" style={{ width: '40%' }} />
                                <div className="skeleton sk-text" style={{ width: '30%' }} />
                            </div>
                        ))}
                    </div>

                    {/* Transaksi */}
                    <div className="sk-card">
                        <div className="skeleton sk-text-lg" style={{ width: '160px', marginBottom: '1rem' }} />
                        {[1, 2, 3, 4, 5].map(i => <SkeletonRow key={i} />)}
                    </div>
                </div>

                {/* Kolom Kanan */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {/* Budget */}
                    <div className="sk-card">
                        <div className="skeleton sk-text-lg" style={{ width: '200px', marginBottom: '1rem' }} />
                        {[1, 2, 3].map(i => <SkeletonBudget key={i} />)}
                    </div>
                    {/* Hutang */}
                    <div className="sk-card">
                        <div className="skeleton sk-text-lg" style={{ width: '140px', marginBottom: '1rem' }} />
                        {[1, 2].map(i => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '0.75rem' }}>
                                <div>
                                    <div className="skeleton sk-text" style={{ width: '100px', marginBottom: '0.4rem' }} />
                                    <div className="skeleton sk-text-sm" style={{ width: '70px' }} />
                                </div>
                                <div className="skeleton sk-text" style={{ width: '80px' }} />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
