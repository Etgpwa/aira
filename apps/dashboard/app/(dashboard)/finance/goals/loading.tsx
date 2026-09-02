export default function GoalsLoading() {
  return (
    <div className="animate-pulse">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <div className="h-7 w-48 bg-surface-variant rounded-xl mb-2" />
          <div className="h-4 w-56 bg-surface-variant/70 rounded-full" />
        </div>
        <div className="w-10 h-10 rounded-full bg-surface-container" />
      </div>

      {/* Hero Tabungan Skeleton */}
      <div className="bg-surface-variant/40 rounded-[24px] p-6 h-[140px] flex items-center justify-between mb-8">
        <div>
          <div className="h-4 w-36 bg-surface-variant/80 rounded-full mb-3" />
          <div className="h-9 w-60 bg-surface-variant rounded-xl" />
        </div>
        <div className="w-14 h-14 rounded-2xl bg-surface-container" />
      </div>

      {/* Grid Goals Cards */}
      <div className="flex justify-between items-center mb-5">
        <div className="h-5 w-36 bg-surface-variant rounded-lg" />
        <div className="h-8 w-32 bg-surface-container rounded-full" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((_, i) => (
          <div key={i} className="bg-surface-bright rounded-[24px] p-5 border border-surface-variant h-[200px] flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-surface-container" />
                <div>
                  <div className="h-4 w-32 bg-surface-variant rounded-md mb-1.5" />
                  <div className="h-3 w-20 bg-surface-variant/60 rounded-md" />
                </div>
              </div>
              <div className="h-3 w-full bg-surface-container rounded-full mb-3" />
              <div className="flex justify-between">
                <div className="h-4 w-20 bg-surface-variant rounded-md" />
                <div className="h-4 w-24 bg-surface-variant/70 rounded-md" />
              </div>
            </div>
            <div className="h-9 w-full bg-surface-container rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
