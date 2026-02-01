"use client";

import type { PlacePin } from "@/types/ui";

export default function PlaceSheet({
  open,
  place,
  sessionActive,
  busy,
  onClose,
  onTakePhoto,
}: {
  open: boolean;
  place: PlacePin | null;
  sessionActive: boolean;
  busy: boolean;
  onClose: () => void;
  onTakePhoto: () => void;
}) {
  if (!open || !place) return null;

  return (
    <div className="absolute inset-x-0 bottom-0 z-30">
      <div className="px-4 pb-4">
        <div className="rounded-3xl bg-neutral-900 border border-white/10 shadow-2xl overflow-hidden">
          <div className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">{place.location}</div>
                <div className="text-xs text-neutral-300">Place</div>
              </div>
              <button
                onClick={onClose}
                className="rounded-full px-3 py-1 text-xs bg-white/10 border border-white/10 active:scale-[0.99]"
              >
                Close
              </button>
            </div>

            {!sessionActive && (
              <div className="mt-3 text-xs text-amber-200 bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3">
                Start a session to enable photo capture.
              </div>
            )}

            <div className="mt-4">
              <button
                disabled={!sessionActive || busy}
                onClick={onTakePhoto}
                className="w-full rounded-2xl py-3 bg-white/10 border border-white/15 font-medium disabled:opacity-50 active:scale-[0.99]"
              >
                Take photo
              </button>
            </div>
          </div>

          <div className="px-4 pb-4">
            <div className="h-1 w-12 bg-white/10 rounded-full mx-auto" />
          </div>
        </div>
      </div>
    </div>
  );
}
