"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PlacePin } from "@/types/ui";
import { startSession, endSession, uploadPhoto } from "@/lib/api";
import TopBar from "@/components/TopBar";
import SessionBar from "@/components/SessionBar";
import PlaceSheet from "@/components/PlaceSheet";
import WrappedPreview from "@/components/WrappedPreview";
import { createAudioStreamFromText } from "@/utils/elevenlabs";

type GeoPoint = {
  lat: number;
  lng: number;
};

type AudioQueueItem = {
  text: string;
  onComplete?: () => void;
};

const MOCK_PIN_FEED: PlacePin[] = [
  {
    id: "coffee-shop",
    name: "Coffee Shop",
    position: { lat: 0, lng: 0 },
    category: "Food",
  },
  {
    id: "museum",
    name: "Museum",
    position: { lat: 0, lng: 0 },
    category: "Culture",
  },
  {
    id: "viewpoint",
    name: "Viewpoint",
    position: { lat: 0, lng: 0 },
    category: "Scenic",
  },
  {
    id: "botanical",
    name: "Botanical Garden",
    position: { lat: 0, lng: 0 },
    category: "Nature",
  },
  {
    id: "market",
    name: "Local Market",
    position: { lat: 0, lng: 0 },
    category: "Shopping",
  },
];

let mockFetchCursor = 0;

type FetchLocationPayload = {
  position: GeoPoint | null;
  headingNormalized: number | null;
};

async function fetchLocations(
  _payload: FetchLocationPayload
): Promise<PlacePin[]> {
  await new Promise((resolve) => setTimeout(resolve, 200));
  if (mockFetchCursor >= MOCK_PIN_FEED.length) return [];
  const nextPins = MOCK_PIN_FEED.slice(mockFetchCursor, mockFetchCursor + 5);
  mockFetchCursor += nextPins.length;
  return nextPins;
}

function resetMockLocationFeed() {
  mockFetchCursor = 0;
}

type SessionState =
  | { status: "IDLE" }
  | { status: "ACTIVE"; sessionId: string; startedAt: number }
  | { status: "ENDED"; recapId: string };

const MOVEMENT_THRESHOLD_METERS = 3;
const EARTH_RADIUS_METERS = 6_371_000;

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

function normalizeDegrees(degrees: number) {
  if (!Number.isFinite(degrees)) return 0;
  const mod = degrees % 360;
  return mod < 0 ? mod + 360 : mod;
}

function normalizeHeadingUnit(degrees: number) {
  return normalizeDegrees(degrees) / 360;
}

function haversineDistance(a: GeoPoint, b: GeoPoint) {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const c = sinLat * sinLat + sinLng * sinLng * Math.cos(lat1) * Math.cos(lat2);
  const distance =
    2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(c)));
  return distance;
}

function calculateBearing(from: GeoPoint, to: GeoPoint) {
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const dLon = toRadians(to.lng - from.lng);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const brng = Math.atan2(y, x);
  return normalizeDegrees((brng * 180) / Math.PI);
}

export default function MapScreen() {
  const [session, setSession] = useState<SessionState>({ status: "IDLE" });
  const [selected, setSelected] = useState<PlacePin | null>(null);
  const [busy, setBusy] = useState(false);
  const [pins, setPins] = useState<PlacePin[]>([]);
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null);
  const [currentPosition, setCurrentPosition] = useState<GeoPoint | null>(null);
  // Heading is stored normalized to 0–1 (0 == 0°, 1 == 360°) for the downstream API payload.
  const [currentHeadingNormalized, setCurrentHeadingNormalized] = useState<
    number | null
  >(null);
  const [audioSessionActive, setAudioSessionActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lastRawPositionRef = useRef<GeoPoint | null>(null);
  const fallbackHeadingRef = useRef<number | null>(null);
  const positionRef = useRef<GeoPoint | null>(null);
  const headingNormalizedRef = useRef<number | null>(null);
  const lastSpokenHighlightRef = useRef<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioChunksQueueRef = useRef<AudioQueueItem[]>([]);
  const processingAudioRef = useRef(false);
  const pinsRef = useRef<PlacePin[]>([]);
  const awaitingNextPinRef = useRef(false);

  const latitudeDisplay = currentPosition
    ? currentPosition.lat.toFixed(5)
    : "—";
  const longitudeDisplay = currentPosition
    ? currentPosition.lng.toFixed(5)
    : "—";
  const headingDegreesDisplay =
    currentHeadingNormalized != null
      ? `${Math.round(currentHeadingNormalized * 360)}°`
      : "—";
  const headingNormalizedDisplay =
    currentHeadingNormalized != null
      ? currentHeadingNormalized.toFixed(2)
      : "—";

  async function onStart() {
    setBusy(true);
    try {
      const res = await startSession();
      resetMockLocationFeed();
      setPins([]);
      setHighlightIndex(null);
      awaitingNextPinRef.current = false;
      setSession({
        status: "ACTIVE",
        sessionId: res.sessionId,
        startedAt: res.startedAt,
      });
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

  useEffect(() => {
    positionRef.current = currentPosition;
  }, [currentPosition]);

  useEffect(() => {
    headingNormalizedRef.current = currentHeadingNormalized;
  }, [currentHeadingNormalized]);

  useEffect(() => {
    pinsRef.current = pins;
  }, [pins]);

  const ensureAudioContext = useCallback(() => {
    if (typeof window === "undefined") return null;
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioCtx();
    }
    if (audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  const playBufferedAudio = useCallback(async () => {
    if (processingAudioRef.current) return;
    processingAudioRef.current = true;
    try {
      const context = ensureAudioContext();
      if (!context) return;
      while (audioChunksQueueRef.current.length > 0) {
        const item = audioChunksQueueRef.current.shift();
        if (!item) continue;
        const stream = await createAudioStreamFromText(item.text);
        const reader = stream.getReader();
        const chunks: Uint8Array[] = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) chunks.push(value);
        }
        const audioData = new Uint8Array(
          chunks.reduce((acc, value) => acc + value.length, 0)
        );
        let offset = 0;
        for (const chunk of chunks) {
          audioData.set(chunk, offset);
          offset += chunk.length;
        }
        const audioBuffer = await context.decodeAudioData(audioData.buffer);
        const source = context.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(context.destination);
        audioSourceRef.current = source;
        await new Promise<void>((resolve) => {
          source.onended = () => {
            resolve();
          };
          source.start();
        });
        item.onComplete?.();
      }
    } catch (error) {
      console.error("Failed to play audio chunk", error);
    } finally {
      processingAudioRef.current = false;
    }
  }, [ensureAudioContext]);

  const queueElevenLabsAudio = useCallback(
    (text: string, options?: { onComplete?: () => void }) => {
      audioChunksQueueRef.current.push({
        text,
        onComplete: options?.onComplete,
      });
      playBufferedAudio();
    },
    [playBufferedAudio]
  );

  const cancelAudio = useCallback(() => {
    audioChunksQueueRef.current = [];
    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.stop();
      } catch {
        // ignore errors when stopping already stopped nodes
      }
      audioSourceRef.current.disconnect();
      audioSourceRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    processingAudioRef.current = false;
    awaitingNextPinRef.current = false;
  }, []);

  const handleHighlightAudioComplete = useCallback((completedIndex: number) => {
    setHighlightIndex((prev) => {
      if (prev !== completedIndex) return prev;
      const nextIndex = completedIndex + 1;
      if (nextIndex < pinsRef.current.length) {
        awaitingNextPinRef.current = false;
        return nextIndex;
      }
      awaitingNextPinRef.current = true;
      return prev;
    });
  }, []);

  useEffect(() => {
    if (session.status !== "ACTIVE") return;

    let cancelled = false;

    async function loadPins() {
      const newPins = await fetchLocations({
        position: positionRef.current,
        headingNormalized: headingNormalizedRef.current,
      });
      if (cancelled || newPins.length === 0) return;
      setPins((prev) => [...prev, ...newPins]);
    }

    loadPins();
    const intervalId = window.setInterval(loadPins, 30_000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [session.status]);

  useEffect(() => {
    if (session.status !== "ACTIVE") {
      awaitingNextPinRef.current = false;
      setHighlightIndex(null);
      return;
    }
    if (pins.length > 0 && highlightIndex === null) {
      setHighlightIndex(0);
    }
  }, [session.status, pins.length, highlightIndex]);

  useEffect(() => {
    if (session.status !== "ACTIVE") return;
    if (!awaitingNextPinRef.current) return;
    setHighlightIndex((prev) => {
      if (prev === null) return prev;
      if (prev < pins.length - 1) {
        awaitingNextPinRef.current = false;
        return prev + 1;
      }
      return prev;
    });
  }, [pins.length, session.status]);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof navigator === "undefined" ||
      !("geolocation" in navigator)
    ) {
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, heading, speed } = pos.coords;
        const nextPos: GeoPoint = { lat: latitude, lng: longitude };
        setCurrentPosition((prev) => {
          const changed =
            !prev || prev.lat !== nextPos.lat || prev.lng !== nextPos.lng;
          return changed ? nextPos : prev;
        });
        positionRef.current = nextPos;

        const lastPos = lastRawPositionRef.current;
        const movedEnough = lastPos
          ? haversineDistance(lastPos, nextPos) > MOVEMENT_THRESHOLD_METERS
          : true;

        let headingCandidate: number | null = null;
        if (
          typeof heading === "number" &&
          !Number.isNaN(heading) &&
          (speed ?? 0) > 1
        ) {
          headingCandidate = normalizeHeadingUnit(heading);
        } else if (lastPos && movedEnough) {
          headingCandidate = normalizeHeadingUnit(
            calculateBearing(lastPos, nextPos)
          );
        } else if (fallbackHeadingRef.current != null) {
          headingCandidate = fallbackHeadingRef.current;
        }

        if (headingCandidate != null) {
          setCurrentHeadingNormalized((prev) =>
            prev === headingCandidate ? prev : headingCandidate
          );
          headingNormalizedRef.current = headingCandidate;
        }

        lastRawPositionRef.current = nextPos;
      },
      (error) => {
        console.error("Failed to watch position", error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1_000,
        timeout: 10_000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let orientationHandler: EventListener | null = null;

    async function setupOrientationListener() {
      if (typeof window === "undefined") return;
      const DeviceOrientation =
        window.DeviceOrientationEvent as typeof DeviceOrientationEvent & {
          requestPermission?: () => Promise<"granted" | "denied" | "prompt">;
        };
      if (!DeviceOrientation) return;

      if (typeof DeviceOrientation.requestPermission === "function") {
        try {
          const permission = await DeviceOrientation.requestPermission();
          if (permission !== "granted") return;
        } catch (error) {
          console.warn("Device orientation permission denied", error);
          return;
        }
      }

      if (cancelled) return;
      orientationHandler = (rawEvent: Event) => {
        const event = rawEvent as DeviceOrientationEvent;
        if (typeof event.alpha !== "number") return;
        const normalized = normalizeHeadingUnit(event.alpha);
        fallbackHeadingRef.current = normalized;
        if (headingNormalizedRef.current == null) {
          headingNormalizedRef.current = normalized;
          setCurrentHeadingNormalized(normalized);
        }
      };
      window.addEventListener(
        "deviceorientationabsolute",
        orientationHandler,
        true
      );
    }

    setupOrientationListener();

    return () => {
      cancelled = true;
      if (orientationHandler) {
        window.removeEventListener(
          "deviceorientationabsolute",
          orientationHandler,
          true
        );
      }
    };
  }, []);

  useEffect(() => {
    if (session.status === "ACTIVE") {
      setAudioSessionActive(true);
      lastSpokenHighlightRef.current = null;
    } else {
      setAudioSessionActive(false);
      lastSpokenHighlightRef.current = null;
      cancelAudio();
    }
  }, [session.status, queueElevenLabsAudio, cancelAudio]);

  useEffect(() => {
    if (!audioSessionActive) return;
    if (session.status !== "ACTIVE") return;
    if (highlightIndex === null) return;
    const pin = pins[highlightIndex];
    if (!pin) return;

    const highlightToken = `${session.status}-${pin.id}-${highlightIndex}`;
    if (lastSpokenHighlightRef.current === highlightToken) return;
    lastSpokenHighlightRef.current = highlightToken;

    const lat = positionRef.current
      ? positionRef.current.lat.toFixed(3)
      : "unknown latitude";
    const lng = positionRef.current
      ? positionRef.current.lng.toFixed(3)
      : "unknown longitude";
    const headingDegrees =
      headingNormalizedRef.current != null
        ? `${Math.round(headingNormalizedRef.current * 360)} degrees`
        : "unknown heading";

    queueElevenLabsAudio(
      `Spotlight now on ${pin.name}. Heading ${headingDegrees}. Approximate location latitude ${lat} and longitude ${lng}.`,
      {
        onComplete: () => handleHighlightAudioComplete(highlightIndex),
      }
    );
  }, [
    audioSessionActive,
    session.status,
    highlightIndex,
    pins,
    queueElevenLabsAudio,
    handleHighlightAudioComplete,
  ]);

  return (
    <div className="min-h-dvh bg-neutral-950 text-white">
      <TopBar />

      <div className="relative h-dvh">
        <div className="absolute inset-0 bg-gradient-to-b from-neutral-900 to-neutral-950">
          <div className="h-full w-full flex flex-col px-4 pb-32 pt-28 gap-4 overflow-y-auto">
            <div className="space-y-2">
              <div className="text-lg font-semibold">Location Pins</div>
              <p className="text-sm text-neutral-300">
                Session updates drop new pins every 30 seconds. Each pin stays
                spotlighted until its audio narration completes, then the next
                available pin takes over.
              </p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 text-sm">
              <div className="text-[11px] uppercase tracking-[0.2em] text-neutral-400">
                Live heading &amp; position
              </div>
              <div className="mt-3 grid grid-cols-2 gap-4 font-mono text-white/90 sm:grid-cols-4">
                <div>
                  <div className="text-[10px] uppercase text-neutral-500 tracking-widest">
                    Latitude
                  </div>
                  <div className="text-base text-white">{latitudeDisplay}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-neutral-500 tracking-widest">
                    Longitude
                  </div>
                  <div className="text-base text-white">{longitudeDisplay}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-neutral-500 tracking-widest">
                    Heading (deg)
                  </div>
                  <div className="text-base text-white">
                    {headingDegreesDisplay}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-neutral-500 tracking-widest">
                    Heading (0-1)
                  </div>
                  <div className="text-base text-white">
                    {headingNormalizedDisplay}
                  </div>
                </div>
              </div>
              <p className="mt-2 text-xs text-neutral-400">
                Values refresh automatically from geolocation + device
                orientation permissions.
              </p>
            </div>
            {pins.length === 0 ? (
              <div className="flex flex-1 items-center justify-center rounded-3xl border border-dashed border-white/20 p-8 text-center text-sm text-neutral-300">
                Pins will appear once the active session begins streaming new
                locations.
              </div>
            ) : (
              <div className="grid gap-3">
                {pins.map((p, index) => {
                  const isHighlighted =
                    highlightIndex === index && session.status === "ACTIVE";
                  return (
                    <button
                      key={p.id}
                      onClick={() => setSelected(p)}
                      className={`rounded-2xl px-4 py-4 text-left transition ${
                        isHighlighted
                          ? "bg-emerald-500/20 border border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.35)]"
                          : "bg-white/5 border border-white/10 hover:bg-white/10"
                      }`}
                    >
                      <div className="text-sm font-medium">{p.name}</div>
                      <div className="text-xs text-neutral-300">
                        {p.category ?? "Place"}
                      </div>
                      {isHighlighted && (
                        <div className="mt-2 text-xs font-semibold text-emerald-300">
                          Currently spotlighted
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
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
          onClose={() => {
            setSelected(null);
          }}
          onTakePhoto={onTakePhoto}
        />

        {/* Wrapped preview after ending */}
        {session.status === "ENDED" && (
          <div className="absolute inset-x-0 bottom-0 z-30">
            <WrappedPreview
              recapId={session.recapId}
              onDismiss={() => setSession({ status: "IDLE" })}
            />
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
