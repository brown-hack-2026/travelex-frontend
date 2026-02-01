// Trip record types
export type TripPhoto = {
  sessionId: string;
  photoId: string;
  placeId: string;
  s3Key: string;
  uploadedAt: number;
  url: string;
};

export type TripLocation = {
  location: {
    location: {
      lat: number;
      lon: number;
    };
    name: string;
    placeId: string;
    placeName: string;
    script: string;
    types: string[];
  };
  photos: TripPhoto[];
  timestamp: number;
};

export type TripRecord = {
  sessionId: string;
  startedAt: number;
  endedAt: number;
  user: string;
  locationPhotoMap: {
    [placeId: string]: TripLocation;
  };
};
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
  sessionId: string,
): Promise<{ sessionId: string }> {
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

async function fetchLocations(
  payload: FetchLocationPayload
): Promise<PlacePin[]> {
  const res = await fetch("/api/backend", {
    method: "POST",
    body: JSON.stringify({
      method: "POST",
      route: "/v1/app/session/tracking",
      payload: {
        sessionId: payload.sessionId,
        prompt:
          payload.prompt.length > 0
            ? payload.prompt
            : "sightseeing Brown University buildings",
        location: {
          lon: payload.position?.lng,
          lat: payload.position?.lat,
        },
        direction: payload.headingNormalized ?? 0,
      },
    }),
  });
  const pinsResult = await res.json();
  return pinsResult.narrated;
}

export async function uploadPhoto(
  sessionId: string,
  place: PlacePin,
  file: File,
): Promise<void> {
  // Convert file to base64 data URL
  const toBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const photoData = await toBase64(file);

  const res = await fetch("/api/backend", {
    method: "POST",
    body: JSON.stringify({
      method: "POST",
      route: "/v1/app/session/upload_photo",
      payload: {
        sessionId,
        placeId: place.placeId,
        photoData,
      },
    }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || "Photo upload failed");
  }
}

function cacheFunctionCall(func: (...args: any) => any, ttl: number) {
  let cache = new Map();

  return async function (...args: any) {
    // Generate a unique key based on the function name (or a fixed key if arguments don't matter)
    const cacheKey = "fixed";

    if (cache.has(cacheKey)) {
      const { data, timestamp } = cache.get(cacheKey);
      // Check if the cache is still valid
      if (Date.now() - timestamp < ttl) {
        console.log(`Returning cached data for key: ${cacheKey}`);
        return data;
      }
    }

    // If not cached or cache expired, call the original function
    const result = await func(...args); // Use await if the wrapped function is async

    // Store the new result in the cache with the current timestamp
    cache.set(cacheKey, {
      data: result,
      timestamp: Date.now(),
    });

    return result;
  };
}

export const fetchLocationsCached: (
  payload: FetchLocationPayload
) => Promise<PlacePin[]> = cacheFunctionCall(fetchLocations, 5000);

export async function getTripData(sessionId: string): Promise<TripRecord> {
  console.log("getTripData sessionId:", sessionId)
  const res = await fetch("/api/backend", {
    method: "POST",
    body: JSON.stringify({
      method: "POST",
      route: "/v1/app/session/compiled",
      payload: { sessionId },
    }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || "Failed to fetch trip data");
  }
  return await res.json();
}
