// src/lib/api.ts
// Stub API functions for MapScreen usage
import type { PlacePin } from "@/types/ui";
import { GeoPoint } from "@/utils/types";

export async function startSession(user: string): Promise<{
  sessionId: string;
  startedAt: number;
}> {
  const res = await fetch("/api/backend", {
    method: "POST",
    body: JSON.stringify({
      method: "POST",
      route: "/v1/app/session/start",
      payload: {
        user,
      },
    }),
  });

  const result = await res.json();

  return result;
}

export async function endSession(
  sessionId: string
): Promise<{ recapId: string }> {
  const res = await fetch("/api/backend", {
    method: "POST",
    body: JSON.stringify({
      method: "POST",
      route: "/v1/app/session/stop",
      payload: {
        sessionId,
      },
    }),
  });

  const result = await res.json();

  return result;
}

type FetchLocationPayload = {
  sessionId: string;
  position: GeoPoint | null;
  headingNormalized: number | null;
  prompt: string;
};

export async function fetchLocations(
  payload: FetchLocationPayload
): Promise<PlacePin[]> {
  const res = await fetch("/api/backend", {
    method: "POST",
    body: JSON.stringify({
      method: "POST",
      route: "/v1/app/session/tracking",
      payload: {
        sessionId: payload.sessionId,
        prompt: payload.prompt,
        location: {
          lon: payload.position?.lng,
          lat: payload.position?.lat,
        },
        direction: payload.headingNormalized ?? 0,
      },
    }),
  });
  const pins = await res.json();
  return pins;
}

export async function uploadPhoto(
  sessionId: string,
  place: PlacePin,
  file: File
): Promise<void> {
  // Replace with real API call
  return;
}
