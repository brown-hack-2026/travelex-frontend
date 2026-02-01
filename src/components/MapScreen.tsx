"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast as toastify, ToastContainer } from "react-toastify";
import type { PlacePin } from "@/types/ui";
import {
  startSession,
  endSession,
  uploadPhoto,
  fetchLocations,
} from "@/lib/api";
import TopBar from "@/components/TopBar";
import SessionBar from "@/components/SessionBar";
import PlaceSheet from "@/components/PlaceSheet";
import WrappedPreview from "@/components/WrappedPreview";
import MapView from "@/components/MapView";
import { createAudioStreamFromText } from "@/utils/elevenlabs";
import CameraModal from "@/components/CameraModal";
import { useAtom } from "jotai";
import { userAtom } from "@/utils/atom";
import { GeoPoint } from "@/utils/types";

const PIN_REFRESH_INTERVAL_MS = 30_000;

type AudioQueueItem = {
  text: string;
  onComplete?: () => void;
};

// const MOCK_PIN_FEED: PlacePin[] = [
//   {
//     id: "coffee-shop",
//     name: "Coffee Shop",
//     position: { lat: 0, lng: 0 },
//     category: "Food",
//   },
//   {
//     id: "museum",
//     name: "Museum",
//     position: { lat: 0, lng: 0 },
//     category: "Culture",
//   },
//   {
//     id: "viewpoint",
//     name: "Viewpoint",
//     position: { lat: 0, lng: 0 },
//     category: "Scenic",
//   },
//   {
//     id: "botanical",
//     name: "Botanical Garden",
//     position: { lat: 0, lng: 0 },
//     category: "Nature",
//   },
//   {
//     id: "market",
//     name: "Local Market",
//     position: { lat: 0, lng: 0 },
//     category: "Shopping",
//   },
//   {
//     id: "brown-university-hall",
//     name: "University Hall (Brown University)",
//     position: { lat: 41.8268, lng: -71.4025 },
//     category: "Historic",
//   },
//   {
//     id: "brown-sci-library",
//     name: "Sciences Library (Brown University)",
//     position: { lat: 41.8263, lng: -71.4004 },
//     category: "Architecture",
//   },
//   {
//     id: "brown-granoff",
//     name: "Granoff Center for the Creative Arts (Brown University)",
//     position: { lat: 41.829, lng: -71.4027 },
//     category: "Arts",
//   },
// ];

// const PIN_KEYWORDS: Record<string, string[]> = {
//   "coffee-shop": ["coffee", "latte", "cafe", "break"],
//   museum: ["museum", "culture", "art", "history"],
//   viewpoint: ["viewpoint", "scenic", "outlook", "sightseeing"],
//   botanical: ["garden", "nature", "plants"],
//   market: ["market", "shopping", "food"],
//   "brown-university-hall": [
//     "brown",
//     "university",
//     "building",
//     "buildings",
//     "sightseeing",
//     "historic",
//   ],
//   "brown-sci-library": [
//     "brown",
//     "university",
//     "building",
//     "buildings",
//     "library",
//     "sightseeing",
//   ],
//   "brown-granoff": [
//     "brown",
//     "university",
//     "building",
//     "buildings",
//     "arts",
//     "sightseeing",
//   ],
// };

// let mockFetchCursor = 0;

// function filterPinsForPrompt(prompt: string) {
//   const normalized = prompt.trim().toLowerCase();
//   if (!normalized) return MOCK_PIN_FEED;
//   const tokens = normalized.split(/\s+/).filter(Boolean);
//   if (tokens.length === 0) return MOCK_PIN_FEED;
//   const filtered = MOCK_PIN_FEED.filter((pin) => {
//     const keywords = PIN_KEYWORDS[pin.id] ?? [];
//     const haystack = `${pin.name} ${pin.category ?? ""} ${keywords.join(
//       " "
//     )}`.toLowerCase();
//     return tokens.every((token) => haystack.includes(token));
//   });
//   return filtered.length > 0 ? filtered : MOCK_PIN_FEED;
// }

// function resetMockLocationFeed() {
//   mockFetchCursor = 0;
// }

type SessionState =
  | { status: "IDLE" }
  | { status: "ACTIVE"; sessionId: string; startedAt: number }
  | { status: "ENDED"; sessionId: string };

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
  // Toast state
  const [toast, setToast] = useState<string | null>(null);
  // Hide toast after 2.5s
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 2500);
      return () => clearTimeout(t);
    }
  }, [toast]);
  const [user] = useAtom(userAtom);
  const [session, setSession] = useState<SessionState>({ status: "IDLE" });
  const [selected, setSelected] = useState<PlacePin | null>(null);
  const [seenPlaces, setSeenPlaces] = useState<{ [key: string]: string }>({});
  const [busy, setBusy] = useState(false);
  const [pins, setPins] = useState<PlacePin[]>([]);
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null);
  const [currentPosition, setCurrentPosition] = useState<GeoPoint | null>(null);
  // Heading is stored normalized to 0–1 (0 == 0°, 1 == 360°) for the downstream API payload.
  const [currentHeadingNormalized, setCurrentHeadingNormalized] = useState<
    number | null
  >(null);
  const [audioSessionActive, setAudioSessionActive] = useState(false);
  const [tourPrompt, setTourPrompt] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "map">("list");

  const [cameraOpen, setCameraOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lastRawPositionRef = useRef<GeoPoint | null>(null);
  const fallbackHeadingRef = useRef<number | null>(null);
  const positionRef = useRef<GeoPoint | null>(null);
  const headingNormalizedRef = useRef<number | null>(null);
  const orientationAvailableRef = useRef(false);
  const lastSpokenHighlightRef = useRef<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioChunksQueueRef = useRef<AudioQueueItem[]>([]);
  const processingAudioRef = useRef(false);
  const pinsRef = useRef<PlacePin[]>([]);
  const awaitingNextPinRef = useRef(false);
  const tourPromptRef = useRef<string>("");
  const loadPinsRef = useRef<((bypassId?: string) => Promise<void>) | null>(
    null
  );

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
  const sessionActive = session.status === "ACTIVE";

  async function onStart() {
    setBusy(true);
    try {
      console.log(user);
      console.log(user?.email);
      const res = await startSession(user?.email ?? "");
      await requestOrientationPermissionAndListen();
      // resetMockLocationFeed();
      setPins([]);
      setHighlightIndex(null);
      awaitingNextPinRef.current = false;
      orientationAvailableRef.current = false;
      setSession({
        status: "ACTIVE",
        sessionId: res.sessionId,
        startedAt: res.startedAt,
      });
      // loadPins(res.sessionId);
    } finally {
      setBusy(false);
    }
  }

  async function onEnd() {
    if (!sessionActive) return;
    setBusy(true);
    try {
      const res = await endSession(session.sessionId);
      setSession({ status: "ENDED", sessionId: res.sessionId });
      setSelected(null);
    } finally {
      setBusy(false);
    }
  }

  function onTakePhoto() {
    if (!sessionActive || !selected) return;
    setCameraOpen(true);
  }

  async function onFilePicked(file: File | null) {
    if (!file || !sessionActive || !selected) return;
    setBusy(true);
    try {
      await uploadPhoto(session.sessionId, selected, file);
      toastify.success("Photo uploaded!");
    } finally {
      setBusy(false);
    }
  }

  async function loadPins(bypassId?: string) {
    if (!bypassId && session.status != "ACTIVE") return;
    console.log("LOADING PINS");
    const newPins = await fetchLocations({
      sessionId: session.status == "ACTIVE" ? session.sessionId : bypassId!,
      position: positionRef.current,
      headingNormalized: headingNormalizedRef.current,
      prompt: tourPromptRef.current,
    });
    if (newPins.length === 0) return;
    const dedupPins = newPins.filter((pin) => !(pin.placeId in seenPlaces));
    setPins((prev) => [...prev, ...dedupPins]);
    setSeenPlaces({
      ...seenPlaces,
      ...Object.fromEntries(dedupPins.map((pin) => [pin.placeId, "exists"])),
    });
  }

  loadPinsRef.current = loadPins;

  useEffect(() => {
    positionRef.current = currentPosition;
  }, [currentPosition]);

  useEffect(() => {
    headingNormalizedRef.current = currentHeadingNormalized;
  }, [currentHeadingNormalized]);

  useEffect(() => {
    pinsRef.current = pins;
  }, [pins]);

  useEffect(() => {
    tourPromptRef.current = tourPrompt.trim();
  }, [tourPrompt]);

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
    if (!sessionActive) {
      awaitingNextPinRef.current = false;
      setHighlightIndex(null);
      return;
    }
    if (pins.length > 0 && highlightIndex === null) {
      setHighlightIndex(0);
    }
  }, [sessionActive, pins.length, highlightIndex]);

  useEffect(() => {
    if (!sessionActive) return;
    if (!awaitingNextPinRef.current) return;
    setHighlightIndex((prev) => {
      if (prev === null) return prev;
      if (prev < pins.length - 1) {
        awaitingNextPinRef.current = false;
        return prev + 1;
      }
      return prev;
    });
  }, [pins.length, sessionActive]);

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
        } else if (
          !orientationAvailableRef.current &&
          fallbackHeadingRef.current != null
        ) {
          headingCandidate = fallbackHeadingRef.current;
        }

        if (headingCandidate != null && !orientationAvailableRef.current) {
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
    if (typeof window === "undefined") return;
    if (!sessionActive) return;
    const triggerPinLoad = () => {
      const loadFn = loadPinsRef.current;
      if (!loadFn) return;
      loadFn().catch((error) => {
        console.error("Failed to load pins", error);
      });
    };
    const intervalId = window.setInterval(() => {
      triggerPinLoad();
    }, PIN_REFRESH_INTERVAL_MS);
    triggerPinLoad();
    return () => {
      window.clearInterval(intervalId);
    };
  }, [sessionActive]);

  const tearDownOrientationListener = useRef<(() => void) | null>(null);

  const requestOrientationPermissionAndListen = useCallback(async () => {
    if (typeof window === "undefined") return;
    tearDownOrientationListener.current?.();
    tearDownOrientationListener.current = null;

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

    const orientationEventName =
      "ondeviceorientationabsolute" in window
        ? "deviceorientationabsolute"
        : "deviceorientation";
    const orientationHandler = (rawEvent: Event) => {
      const event = rawEvent as DeviceOrientationEvent;
      if (typeof event.alpha !== "number") return;
      const normalized = normalizeHeadingUnit(event.alpha);
      orientationAvailableRef.current = true;
      fallbackHeadingRef.current = normalized;
      headingNormalizedRef.current = normalized;
      setCurrentHeadingNormalized((prev) =>
        prev === normalized ? prev : normalized
      );
    };
    window.addEventListener(orientationEventName, orientationHandler, true);
    tearDownOrientationListener.current = () => {
      window.removeEventListener(
        orientationEventName,
        orientationHandler,
        true
      );
    };
  }, []);

  useEffect(() => {
    if (!sessionActive) {
      tearDownOrientationListener.current?.();
      tearDownOrientationListener.current = null;
    }
  }, [sessionActive]);

  useEffect(() => {
    return () => {
      tearDownOrientationListener.current?.();
      tearDownOrientationListener.current = null;
    };
  }, []);

  useEffect(() => {
    if (sessionActive) {
      setAudioSessionActive(true);
      lastSpokenHighlightRef.current = null;
      queueElevenLabsAudio(
        "Spotlight audio stream initiated. Listening for upcoming pins."
      );
    } else {
      setAudioSessionActive(false);
      lastSpokenHighlightRef.current = null;
      cancelAudio();
    }
  }, [sessionActive, queueElevenLabsAudio, cancelAudio]);

  useEffect(() => {
    if (!audioSessionActive) return;
    if (!sessionActive) return;
    if (highlightIndex === null) return;
    const pin = pins[highlightIndex];
    if (!pin) return;

    const highlightToken = `${session.status}-${pin.placeId}-${highlightIndex}`;
    if (lastSpokenHighlightRef.current === highlightToken) return;
    lastSpokenHighlightRef.current = highlightToken;

    queueElevenLabsAudio(pin.script, {
      onComplete: () => handleHighlightAudioComplete(highlightIndex),
    });
  }, [
    audioSessionActive,
    sessionActive,
    highlightIndex,
    pins,
    queueElevenLabsAudio,
    handleHighlightAudioComplete,
  ]);

  return (
    <div className="min-h-dvh bg-neutral-950 text-white">
      <TopBar />

      <div className="relative h-dvh">
        <ToastContainer
          position="top-center"
          autoClose={2500}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="dark"
        />
        {/* Toast notification */}
        {toast && (
          <div className="fixed top-6 left-1/2 z-50 -translate-x-1/2 bg-neutral-900 text-white px-6 py-3 rounded-xl shadow-lg border border-emerald-400 animate-fade-in-out">
            {toast}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-neutral-900 to-neutral-950">
          <div className="h-full w-full flex flex-col px-4 pb-16 pt-28 gap-4 overflow-y-auto">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-lg font-semibold">
                  {viewMode === "list" ? "Location Pins" : "Map View"}
                </div>
                <button
                  onClick={() =>
                    setViewMode(viewMode === "list" ? "map" : "list")
                  }
                  className="rounded-2xl bg-white/10 border border-white/15 px-4 py-2 text-sm hover:bg-white/20 transition"
                >
                  {viewMode === "list" ? "Map View" : "List View"}
                </button>
              </div>
              <p className="text-sm text-neutral-300">
                {viewMode === "list"
                  ? "Session updates drop new pins every 30 seconds. Each pin stays spotlighted until its audio narration completes, then the next available pin takes over."
                  : "Interactive map with clickable pin markers. Click a marker to view details."}
              </p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Tour focus prompt</div>
                  <p className="text-xs text-neutral-400">
                    Describe the kinds of places you want highlighted before
                    starting a session.
                  </p>
                </div>
                {sessionActive && (
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-emerald-300">
                    Active
                  </span>
                )}
              </div>
              <textarea
                value={tourPrompt}
                onChange={(e) => setTourPrompt(e.target.value)}
                disabled={sessionActive}
                placeholder="e.g., sightseeing Brown University buildings"
                className="w-full rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-neutral-500 disabled:opacity-60"
                rows={2}
              />
              <p className="text-xs text-neutral-400">
                The prompt filters upcoming pins (try “cafes near downtown” or
                “sightseeing Brown University buildings”).
              </p>
            </div>
            {/* <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 text-sm">
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
            </div> */}
            {viewMode === "map" ? (
              <div className="h-[60vh] w-full rounded-3xl overflow-hidden border border-white/10">
                <MapView
                  pins={pins}
                  highlightIndex={highlightIndex}
                  selectedPin={selected}
                  currentPosition={currentPosition}
                  onPinClick={setSelected}
                />
              </div>
            ) : pins.length === 0 ? (
              <div className="flex flex-1 items-center justify-center rounded-3xl border border-dashed border-white/20 p-8 text-center text-sm text-neutral-300">
                Pins will appear once the active session begins streaming new
                locations.
              </div>
            ) : (
              <div className="grid gap-3">
                {pins.map((p, index) => {
                  const isHighlighted =
                    highlightIndex === index && sessionActive;
                  return (
                    <button
                      key={index}
                      onClick={() => setSelected(p)}
                      className={`rounded-2xl px-4 py-4 text-left transition ${
                        isHighlighted
                          ? "bg-emerald-500/20 border border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.35)]"
                          : "bg-white/5 border border-white/10 hover:bg-white/10"
                      }`}
                    >
                      <div className="text-sm font-medium">{p.placeName}</div>
                      <div className="text-xs text-neutral-300">Place</div>
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
            headingValue={headingDegreesDisplay}
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
          sessionActive={sessionActive}
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
              sessionId={session.sessionId}
              onDismiss={() => setSession({ status: "IDLE" })}
            />
          </div>
        )}

        {/* Camera modal for taking photos */}
        <CameraModal
          open={cameraOpen}
          onClose={() => setCameraOpen(false)}
          onCapture={(file) => onFilePicked(file)}
        />
      </div>
    </div>
  );
}
