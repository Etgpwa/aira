
function SkeletonGoalCard() {
    return (
        <div className="sk-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div className="skeleton sk-text-lg" style={{ width: '55%' }} />
                <div className="skeleton sk-text-sm" style={{ width: '70px', height: '24px', borderRadius: '9999px' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', marginBottom: '0.75rem' }}>
                <div>
                    <div className="skeleton sk-text-sm" style={{ width: '60px', marginBottom: '0.35rem' }} />
                    <div className="skeleton sk-text" style={{ width: '90px' }} />
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div className="skeleton sk-text-sm" style={{ width: '45px', marginBottom: '0.35rem' }} />
                    <div className="skeleton sk-text" style={{ width: '80px' }} />
                </div>
            </div>
            <div className="skeleton sk-progress" style={{ width: '100%', marginBottom: '0.3rem' }} />
            <div className="skeleton sk-text-sm" style={{ width: '35px', marginLeft: 'auto' }} />
        </div>
    );
}

export default function GoalsLoading() {
    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div className="skeleton sk-text-2xl" style={{ width: '170px' }} />
                <div className="skeleton sk-btn" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                {[1, 2, 3].map(i => <SkeletonGoalCard key={i} />)}
            </div>
        </div>
    );
}
