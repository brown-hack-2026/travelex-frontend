export type LatLng = { lat: number; lng: number };

export type PlacePin = {
  placeId: string;
  script: string;
  placeName: string;
  types?: string[];
  name?: string;
  location?: {
    lat: number;
    lon: number;
  };
};
