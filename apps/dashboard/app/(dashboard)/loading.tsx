import './page.css';

function SkeletonCard() {
    return (
        <div className="sk-card">
            <div className="flex justify-between items-center mb-3">
                <div className="skeleton sk-text" style={{ width: '40%' }} />
                <div className="skeleton sk-icon" />
            </div>
            <div className="skeleton sk-text-2xl" style={{ width: '70%', marginTop: '0.5rem' }} />
        </div>
    );
}

export default function DashboardLoading() {
    return (
        <div className="dashboard-container">
            <header className="mb-6">
                <div className="skeleton sk-text-xl" style={{ width: '120px' }} />
                <div className="skeleton sk-text-sm" style={{ width: '200px', marginTop: '0.5rem' }} />
            </header>

            {/* 4 Summary Cards */}
            <div className="summary-grid">
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
            </div>

            {/* Chart Skeleton */}
            <div className="mt-8 sk-card" style={{ height: '350px' }}>
                <div className="skeleton sk-text-lg" style={{ width: '200px', marginBottom: '1.5rem' }} />
                {/* Bar chart skeleton */}
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', height: '220px', padding: '0 1rem' }}>
                    {[60, 80, 45, 90, 55, 75].map((h, i) => (
                        <div key={i} style={{ flex: 1, display: 'flex', gap: '4px', alignItems: 'flex-end' }}>
                            <div className="skeleton sk-bar" style={{ flex: 1, height: `${h * 0.7}%` }} />
                            <div className="skeleton sk-bar" style={{ flex: 1, height: `${h * 0.5}%` }} />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
