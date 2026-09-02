export default function TasksLoading() {
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

      {/* Kanban 3 Columns Skeleton */}
      <div className="flex-1 overflow-x-auto flex gap-5 pb-4">
        {[1, 2, 3].map((colIndex) => (
          <div key={colIndex} className="w-[310px] shrink-0 flex flex-col gap-3">
            <div className="flex items-center justify-between mb-2">
              <div className="h-5 w-24 bg-surface-variant rounded-md" />
              <div className="h-4 w-8 bg-surface-container rounded-full" />
            </div>

            {[1, 2].map((cardIndex) => (
              <div key={cardIndex} className="bg-surface-bright border border-surface-variant rounded-[20px] p-4 h-[160px] flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <div className="h-4 w-36 bg-surface-variant rounded-md" />
                    <div className="h-4 w-12 bg-surface-container rounded-full" />
                  </div>
                  <div className="h-3 w-full bg-surface-container/60 rounded-md mb-1.5" />
                  <div className="h-3 w-3/4 bg-surface-container/60 rounded-md" />
                </div>
                <div className="h-8 w-full bg-surface-container rounded-xl" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
