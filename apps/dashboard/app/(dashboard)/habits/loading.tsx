export default function Loading() {
  return (
    <div className="h-full flex flex-col bg-surface overflow-hidden p-6 gap-8">
      {/* Header Skeleton */}
      <div className="flex justify-between items-center shrink-0">
        <div className="space-y-2">
          <div className="w-48 h-8 bg-surface-variant rounded-full animate-pulse"></div>
          <div className="w-32 h-4 bg-surface-variant/50 rounded-full animate-pulse"></div>
        </div>
      </div>

      {/* Grid Skeleton */}
      <div className="grid grid-cols-2 gap-4">
        <div className="h-24 bg-surface-bright border border-surface-variant rounded-[20px] shadow-sm animate-pulse"></div>
        <div className="h-24 bg-surface-bright border border-surface-variant rounded-[20px] shadow-sm animate-pulse"></div>
      </div>

      {/* List Skeleton */}
      <div className="flex-1 space-y-4">
        <div className="w-40 h-6 bg-surface-variant rounded-full animate-pulse"></div>
        <div className="h-32 bg-surface-bright border border-surface-variant rounded-[20px] shadow-sm animate-pulse"></div>
      </div>
    </div>
  );
}
