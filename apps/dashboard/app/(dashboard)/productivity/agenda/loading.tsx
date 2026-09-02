export default function AgendaLoading() {
  return (
    <div className="h-full flex flex-col animate-pulse px-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <div className="h-7 w-28 bg-surface-variant rounded-xl mb-2" />
          <div className="h-4 w-48 bg-surface-variant/70 rounded-full" />
        </div>
        <div className="w-10 h-10 rounded-full bg-surface-container" />
      </div>

      {/* Agenda 6 Hari Horizontal Skeleton */}
      <div className="flex-1 overflow-x-auto flex gap-4 pb-4">
        {[1, 2, 3, 4, 5, 6].map((dayIndex) => (
          <div key={dayIndex} className="w-[280px] shrink-0 flex flex-col gap-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-surface-container" />
                <div className="h-4 w-16 bg-surface-variant rounded-md" />
              </div>
              <div className="h-4 w-6 bg-surface-container rounded-full" />
            </div>

            {[1, 2].map((cardIndex) => (
              <div key={cardIndex} className="bg-surface-bright border border-surface-variant rounded-[20px] p-4 h-[110px] flex flex-col justify-between">
                <div className="h-4 w-24 bg-surface-container rounded-md" />
                <div className="h-4 w-36 bg-surface-variant rounded-md" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
