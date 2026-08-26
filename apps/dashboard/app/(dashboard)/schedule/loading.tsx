
function SkeletonScheduleItem() {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--border-color)' }}>
            <div>
                <div className="skeleton sk-text-sm" style={{ width: '60px', marginBottom: '0.3rem' }} />
                <div className="skeleton sk-text" style={{ width: '90px' }} />
            </div>
            <div className="skeleton sk-icon" />
        </div>
    );
}

function SkeletonDayColumn() {
    return (
        <div className="sk-card">
            <div className="skeleton sk-text-lg" style={{ width: '70px', marginBottom: '1rem', paddingBottom: '0.5rem' }} />
            <SkeletonScheduleItem />
            <SkeletonScheduleItem />
        </div>
    );
}

export default function ScheduleLoading() {
    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div className="skeleton sk-text-2xl" style={{ width: '170px' }} />
                <div className="skeleton sk-btn" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
                {[1, 2, 3, 4, 5, 6, 7].map(i => <SkeletonDayColumn key={i} />)}
            </div>
        </div>
    );
}
