export type LatLng = { lat: number; lng: number };

export type PlacePin = {
  id: string;
  name: string;
  position: LatLng;
  category?: string;
  headingDegrees?: number;
  headingNormalized?: number;
};
