"use client";

import { useJsApiLoader } from "@react-google-maps/api";

export const GOOGLE_MAPS_API_KEY =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

const LOADER_OPTIONS: any = {
  id: "google-maps-script",
  googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  libraries: ["places", "geometry", "drawing"] as const,
};

export function useGoogleMapsLoader() {
  return useJsApiLoader(LOADER_OPTIONS);
}
