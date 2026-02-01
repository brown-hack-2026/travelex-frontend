"use client";

import { SessionState } from "@/types/ui";

export default function SessionBar({
  headingValue,
  session,
  busy,
  onStart,
  onEnd,
}: {
  headingValue: string;
  session: SessionState;
  busy: boolean;
  onStart: () => void;
  onEnd: () => void;
}) {
  return (
    <div className="flex gap-2">
      {session.status !== "ACTIVE" ? (
        <button
          disabled={busy}
          onClick={onStart}
          className="flex-1 rounded-2xl bg-white text-neutral-950 py-3 font-medium disabled:opacity-60 active:scale-[0.99]"
        >
          Start session
        </button>
      ) : (
        <button
          disabled={busy}
          onClick={onEnd}
          className="flex-1 rounded-2xl bg-red-500 text-white py-3 font-medium disabled:opacity-60 active:scale-[0.99]"
        >
          End session
        </button>
      )}

      <div className="rounded-2xl bg-white/10 border border-white/15 px-3 py-3 text-xs text-neutral-200 min-w-[110px] text-center backdrop-blur">
        {session.status === "ACTIVE"
          ? "Recording…"
          : session.status === "ENDED"
          ? "Recap ready"
          : "Not started"}
      </div>
      <div className="rounded-2xl bg-white/10 border border-white/15 px-3 py-3 text-xs text-neutral-200 min-w-[110px] text-center backdrop-blur">
        {headingValue}
      </div>
    </div>
  );
}
