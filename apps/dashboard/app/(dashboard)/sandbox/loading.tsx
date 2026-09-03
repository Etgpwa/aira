export default function SandboxLoading() {
    return (
        <div className="flex flex-col h-[calc(100dvh-5rem)] md:h-[calc(100vh-2rem)] max-w-5xl mx-auto px-2 md:px-6 py-2 animate-pulse">
            {/* Header Skeleton */}
            <div className="flex items-center justify-between bg-surface-container/40 border border-surface-variant rounded-2xl px-4 py-3 shadow-sm mb-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-surface-variant/80" />
                    <div>
                        <div className="h-5 w-40 bg-surface-variant rounded-md mb-1.5" />
                        <div className="h-3 w-56 bg-surface-variant/70 rounded-md" />
                    </div>
                </div>
                <div className="h-8 w-24 bg-surface-variant/80 rounded-xl" />
            </div>

            {/* Banner Skeleton */}
            <div className="h-10 w-full bg-surface-variant/40 rounded-xl mb-3" />

            {/* Chat Skeleton Area */}
            <div className="flex-1 rounded-2xl bg-surface-container-lowest border border-surface-variant/60 p-4 space-y-4">
                <div className="flex items-start gap-2 max-w-[80%]">
                    <div className="w-7 h-7 rounded-lg bg-surface-variant/80 flex-shrink-0" />
                    <div className="h-16 w-3/4 bg-surface-variant/50 rounded-2xl rounded-bl-none" />
                </div>
                <div className="flex justify-end">
                    <div className="h-12 w-1/2 bg-surface-variant/70 rounded-2xl rounded-br-none" />
                </div>
                <div className="flex items-start gap-2 max-w-[80%]">
                    <div className="w-7 h-7 rounded-lg bg-surface-variant/80 flex-shrink-0" />
                    <div className="h-24 w-4/5 bg-surface-variant/50 rounded-2xl rounded-bl-none" />
                </div>
            </div>

            {/* Input Skeleton */}
            <div className="h-12 w-full bg-surface-variant/60 rounded-xl mt-3" />
        </div>
    );
}
