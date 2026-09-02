export default function FinanceLoading() {
  return (
    <div className="animate-pulse">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <div className="h-7 w-36 bg-surface-variant rounded-xl mb-2" />
          <div className="h-4 w-52 bg-surface-variant/70 rounded-full" />
        </div>
        <div className="w-10 h-10 rounded-full bg-surface-container" />
      </div>

      {/* 2-Column Grid */}
      <div className="lg:grid lg:grid-cols-[1fr_380px] lg:gap-8 lg:items-start">
        {/* Left Column */}
        <div>
          {/* Total Kas & Rekening Card */}
          <div className="bg-surface-bright border-2 border-surface-variant rounded-[24px] p-5 mb-6">
            <div className="h-4 w-36 bg-surface-variant/70 rounded-full mb-2" />
            <div className="h-9 w-60 bg-surface-variant rounded-xl mb-5" />

            <div className="flex flex-col gap-2.5">
              {[1, 2, 3].map((_, i) => (
                <div key={i} className="flex items-center justify-between p-3.5 bg-surface-container-low rounded-[16px]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-surface-container" />
                    <div className="h-4 w-28 bg-surface-variant rounded-md" />
                  </div>
                  <div className="h-5 w-24 bg-surface-variant rounded-md" />
                </div>
              ))}
            </div>
          </div>

          {/* Hutang & Piutang Card */}
          <div className="mb-6">
            <div className="h-5 w-40 bg-surface-variant rounded-lg mb-4" />
            <div className="flex flex-col gap-3">
              {[1, 2].map((_, i) => (
                <div key={i} className="bg-surface-bright p-4 rounded-[20px] border border-surface-variant flex justify-between items-center">
                  <div className="flex-1">
                    <div className="h-4 w-32 bg-surface-variant rounded-md mb-2" />
                    <div className="h-3 w-20 bg-surface-variant/60 rounded-md" />
                  </div>
                  <div className="h-5 w-24 bg-surface-variant rounded-md" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="flex flex-col gap-6">
          {/* Budget Card */}
          <div className="bg-surface-bright rounded-[24px] p-5 border border-surface-variant">
            <div className="h-5 w-36 bg-surface-variant rounded-lg mb-4" />
            <div className="flex flex-col gap-4">
              {[1, 2].map((_, i) => (
                <div key={i}>
                  <div className="flex justify-between mb-2">
                    <div className="h-4 w-24 bg-surface-variant rounded-md" />
                    <div className="h-4 w-12 bg-surface-variant rounded-md" />
                  </div>
                  <div className="h-2.5 w-full bg-surface-container rounded-full" />
                </div>
              ))}
            </div>
          </div>

          {/* Transaction History Card */}
          <div className="bg-surface-bright rounded-[24px] p-4 border border-surface-variant">
            <div className="h-5 w-40 bg-surface-variant rounded-lg mb-4" />
            <div className="flex flex-col gap-2">
              {[1, 2, 3, 4].map((_, i) => (
                <div key={i} className="flex items-center justify-between p-2.5 bg-surface-container-low rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-surface-container" />
                    <div>
                      <div className="h-4 w-28 bg-surface-variant rounded-md mb-1" />
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
    </div>
  );
}
