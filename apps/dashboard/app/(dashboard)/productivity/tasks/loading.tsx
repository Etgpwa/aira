
function SkeletonTaskCard() {
    return (
        <div style={{ background: 'var(--bg-secondary)', borderRadius: '8px', padding: '1rem', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <div className="skeleton sk-text" style={{ width: '60%' }} />
                <div className="skeleton sk-text-sm" style={{ width: '50px' }} />
            </div>
            <div className="skeleton sk-text-sm" style={{ width: '80%', marginBottom: '0.75rem' }} />
            <div className="skeleton sk-text-sm" style={{ width: '50%', marginBottom: '1rem' }} />
            <div style={{ display: 'flex', gap: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
                <div className="skeleton sk-btn" style={{ flex: 1, height: '30px', width: 'auto' }} />
                <div className="skeleton sk-btn" style={{ flex: 1, height: '30px', width: 'auto' }} />
            </div>
        </div>
    );
}

function SkeletonColumn({ count }: { count: number }) {
    return (
        <div className="sk-card" style={{ minHeight: '400px' }}>
            <div className="skeleton sk-text-lg" style={{ width: '120px', marginBottom: '1rem' }} />
            {Array.from({ length: count }).map((_, i) => <SkeletonTaskCard key={i} />)}
        </div>
    );
}

export default function TasksLoading() {
    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div className="skeleton sk-text-2xl" style={{ width: '80px' }} />
                <div className="skeleton sk-btn" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                <SkeletonColumn count={2} />
                <SkeletonColumn count={1} />
                <SkeletonColumn count={3} />
            </div>
        </div>
    );
}
