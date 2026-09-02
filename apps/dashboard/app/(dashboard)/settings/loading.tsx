export default function SettingsLoading() {
  return (
    <div className="animate-pulse">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <div className="h-7 w-36 bg-surface-variant rounded-xl mb-2" />
          <div className="h-4 w-64 bg-surface-variant/70 rounded-full" />
        </div>
        <div className="w-10 h-10 rounded-full bg-surface-container" />
      </div>

      {/* 2-Column Grid Skeleton */}
      <div className="flex flex-col lg:grid lg:grid-cols-2 gap-6">
        <div className="bg-surface-bright rounded-[24px] p-6 border border-surface-variant h-[340px]">
          <div className="h-5 w-32 bg-surface-variant rounded-md mb-4" />
          <div className="flex flex-col gap-3">
            <div className="h-10 w-full bg-surface-container rounded-xl" />
            <div className="h-10 w-full bg-surface-container rounded-xl" />
            <div className="h-10 w-full bg-surface-container rounded-xl" />
          </div>
        </div>

        <div className="bg-surface-bright rounded-[24px] p-6 border border-surface-variant h-[340px]">
          <div className="h-5 w-32 bg-surface-variant rounded-md mb-4" />
          <div className="flex flex-col gap-3">
            <div className="h-12 w-full bg-surface-container rounded-xl" />
            <div className="h-12 w-full bg-surface-container rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
