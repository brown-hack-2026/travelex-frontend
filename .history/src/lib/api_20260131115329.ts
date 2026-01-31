// src/lib/api.ts
// Stub API functions for MapScreen usage
import type { PlacePin } from "@/types/ui";

export async function startSession(): Promise<{ sessionId: string; startedAt: number }> {
  // Replace with real API call
  return { sessionId: "mock-session", startedAt: Date.now() };
}

export async function endSession(sessionId: string): Promise<{ recapId: string }> {
  // Replace with real API call
  return { recapId: "mock-recap" };
}

export async function requestGuide(sessionId: string, place: PlacePin): Promise<{ summaryText: string; audioUrl?: string }> {
  // Replace with real API call
  return { summaryText: `Guide for ${place.name}` };
}

export async function uploadPhoto(sessionId: string, place: PlacePin, file: File): Promise<void> {
  // Replace with real API call
  return;
}
