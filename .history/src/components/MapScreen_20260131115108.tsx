"use client";

import { useMemo, useRef, useState } from "react";
import type { PlacePin } from "@/types/ui";
import { startSession, endSession, requestGuide, uploadPhoto } from "@/lib/api";
import TopBar from "@/components/TopBar";
import SessionBar from "@/components/SessionBar";
import PlaceSheet from "@/components/PlaceSheet";
import WrappedPreview from "@/components/WrappedPreview";

const MOCK_PINS: PlacePin[] = [
  { id: "1", name: "Coffee Shop", position: { lat: 0, lng: 0 }, category: "Food" },
  { id: "2", name: "Museum", position: { lat: 0, lng: 0 }, category: "Culture" },
  { id: "3", name: "Viewpoint", position: { lat: 0, lng: 0 }, category: "Scenic" },
];

type SessionState =
  | { status: "IDLE" }
  | { status: "ACTIVE"; sessionId: string; startedAt: number }
  | { status: "ENDED"; recapId: string };

export default function MapScreen() {
  const [session, setSession] = useState<SessionState>({ status: "IDLE" });
  const [selected, setSelected] = useState<PlacePin | null>(null);
  const [guideText, setGuideText] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const pins = useMemo(() => MOCK_PINS, []);

  async function onStart() {
    setBusy(true);
    try {
      const res = await startSession();
      setSession({ status: "ACTIVE", sessionId: res.sessionId, startedAt: res.startedAt });
    } finally {
      setBusy(false);
    }
  }

  async function onEnd() {
    if (session.status !== "ACTIVE") return;
    setBusy(true);
    try {
      const res = await endSession(session.sessionId);
      setSession({ status: "ENDED", recapId: res.recapId });
      setSelected(null);
    } finally {
      setBusy(false);
    }
  }

  async function onGuide() {
    if (!selected || session.status !== "ACTIVE") return;
    setBusy(true);
    try {
      const res = await requestGuide(session.sessionId, selected);
      setGuideText(res.summaryText);
      // later: play res.audioUrl
    } finally {
      setBusy(false);
    }
  }

  function onTakePhoto() {
    if (session.status !== "ACTIVE" || !selected) return;
    fileInputRef.current?.click();
  }

  async function onFilePicked(file: File | null) {
    if (!file || session.status !== "ACTIVE" || !selected) return;
    setBusy(true);
    try {
      await uploadPhoto(session.sessionId, selected, file);
      // optional toast
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh bg-neutral-950 text-white">
      <TopBar />

      {/* MAP AREA (placeholder for now) */}
      <div className="relative h-dvh">
        <div className="absolute inset-0 bg-gradient-to-b from-neutral-900 to-neutral-950">
          {/* Replace this with Google Maps / Mapbox later */}
          <div className="h-full w-full flex items-center justify-center">
            <div className="text-center space-y-2 px-6">
              <div className="text-lg font-semibold">Map goes here</div>
              <div className="text-sm text-neutral-300">
                For hackathon speed, we’re using mock pins. We’ll drop in Google Maps next.
              </div>
            </div>
          </div>

          {/* Mock pins */}
          <div className="absolute inset-0">
            <div className="absolute left-6 top-40 space-y-3">
              {pins.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelected(p)}
                  className="rounded-2xl bg-white/10 border border-white/15 px-4 py-3 text-left w-[240px] active:scale-[0.99]"
                >
                  <div className="text-sm font-medium">{p.name}</div>
                  <div className="text-xs text-neutral-300">{p.category ?? "Place"}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Session controls */}
        <div className="absolute top-14 left-0 right-0 px-4 z-20">
          <SessionBar
            session={session}
            busy={busy}
            onStart={onStart}
            onEnd={onEnd}
          />
        </div>

        {/* Place bottom sheet */}
        <PlaceSheet
          open={!!selected}
          place={selected}
          sessionActive={session.status === "ACTIVE"}
          busy={busy}
          guideText={guideText}
          onClose={() => {
            setSelected(null);
            setGuideText("");
          }}
          onGuide={onGuide}
          onTakePhoto={onTakePhoto}
        />

        {/* Wrapped preview after ending */}
        {session.status === "ENDED" && (
          <div className="absolute inset-x-0 bottom-0 z-30">
            <WrappedPreview recapId={session.recapId} onDismiss={() => setSession({ status: "IDLE" })} />
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => onFilePicked(e.target.files?.[0] ?? null)}
        />
      </div>
    </div>
  );
}
