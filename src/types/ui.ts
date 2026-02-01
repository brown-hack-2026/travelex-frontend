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

export type SessionState =
  | { status: "IDLE" }
  | { status: "ACTIVE"; sessionId: string; startedAt: number }
  | { status: "ENDED"; sessionId: string };


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