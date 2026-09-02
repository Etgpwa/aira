export default function HomeLoading() {
  return (
    <div className="animate-pulse">
      {/* Header Profil Skeleton */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <div className="h-4 w-32 bg-surface-variant/70 rounded-full mb-2" />
          <div className="h-7 w-48 bg-surface-variant rounded-xl" />
        </div>
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-surface-container" />
          <div className="w-10 h-10 rounded-full bg-surface-container" />
        </div>
      </div>

      {/* Top Section: Hero + Stats (lg: side-by-side) */}
      <div className="lg:grid lg:grid-cols-[1fr_300px] lg:gap-6 mb-8">
        {/* Hero Balance Card Skeleton */}
        <div className="bg-surface-variant/40 rounded-[24px] p-6 h-[170px] flex flex-col justify-between mb-4 lg:mb-0">
          <div>
            <div className="h-4 w-28 bg-surface-variant/80 rounded-full mb-3" />
            <div className="h-9 w-56 bg-surface-variant rounded-xl" />
          </div>
          <div className="flex gap-2">
            <div className="h-7 w-24 bg-surface-variant/80 rounded-full" />
            <div className="h-7 w-24 bg-surface-variant/80 rounded-full" />
          </div>
        </div>

        {/* Stats 2 Card Skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
          <div className="bg-surface-bright border border-surface-variant p-4 rounded-[20px] h-[78px] flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-surface-container" />
            <div className="flex-1">
              <div className="h-3 w-16 bg-surface-variant/70 rounded-full mb-2" />
              <div className="h-5 w-24 bg-surface-variant rounded-lg" />
            </div>
          </div>
          <div className="bg-surface-bright border border-surface-variant p-4 rounded-[20px] h-[78px] flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-surface-container" />
            <div className="flex-1">
              <div className="h-3 w-16 bg-surface-variant/70 rounded-full mb-2" />
              <div className="h-5 w-24 bg-surface-variant rounded-lg" />
            </div>
          </div>
        </div>
      </div>

      {/* Mid Section: Chart + Activity */}
      <div className="lg:grid lg:grid-cols-[1.5fr_1fr] lg:gap-8">
        {/* Chart Skeleton */}
        <div className="bg-surface-bright border border-surface-variant rounded-[24px] p-6 mb-6 lg:mb-0 h-[320px]">
          <div className="flex justify-between items-center mb-6">
            <div className="h-5 w-36 bg-surface-variant rounded-lg" />
            <div className="h-4 w-20 bg-surface-variant/70 rounded-full" />
          </div>
          <div className="h-[210px] w-full bg-surface-container/50 rounded-2xl flex items-end justify-between p-4 gap-3">
            {[40, 70, 55, 90, 65, 80, 50].map((h, i) => (
              <div key={i} className="flex-1 bg-surface-variant/80 rounded-t-lg" style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>

        {/* Recent Transactions Skeleton */}
        <div className="bg-surface-bright border border-surface-variant rounded-[24px] p-5 h-[320px]">
          <div className="h-5 w-36 bg-surface-variant rounded-lg mb-4" />
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((_, i) => (
              <div key={i} className="flex items-center justify-between p-2.5 bg-surface-container-low rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-surface-container" />
                  <div>
                    <div className="h-4 w-24 bg-surface-variant rounded-md mb-1.5" />
                    <div className="h-3 w-16 bg-surface-variant/60 rounded-md" />
                  </div>
                </div>
                <div className="h-4 w-20 bg-surface-variant rounded-md" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
