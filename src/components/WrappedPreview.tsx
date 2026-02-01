"use client";

import { useRouter } from "next/navigation";

export default function WrappedPreview({
  sessionId,
  onDismiss,
}: {
  sessionId: string;
  onDismiss: () => void;
}) {
  const router = useRouter();

  return (
    <div className="px-4 pb-6">
      <div className="rounded-3xl bg-gradient-to-b from-neutral-800 to-neutral-950 border border-white/10 p-4 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-lg font-semibold">Your trip recap</div>
            <div className="text-xs text-neutral-300">
              Spotify Wrapped style (coming next)
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="rounded-full px-3 py-1 text-xs bg-white/10 border border-white/10"
          >
            Dismiss
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-white/10 border border-white/10 p-3">
            <div className="text-xs text-neutral-300">Recap ID</div>
            <div className="text-sm font-medium truncate">{sessionId}</div>
          </div>
          <button
            className="rounded-2xl bg-white text-neutral-950 font-medium py-3 active:scale-[0.99]"
            onClick={() => router.push(`/trip_record?sessionId=${sessionId}`)}
          >
            View Recap
          </button>
        </div>
        <div className="mt-2">
          <button
            className="w-full rounded-2xl bg-white/10 border border-white/10 py-3 text-sm font-medium active:scale-[0.99]"
            onClick={() => {
              navigator
                .share?.({
                  title: "My Trip Recap",
                  text: "Check out my trip recap!",
                })
                .catch(() => {});
            }}
          >
            Share
          </button>
        </div>
      </div>
    </div>
  );
}
