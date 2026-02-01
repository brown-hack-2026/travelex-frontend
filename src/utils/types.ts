export type BackendPayload = {
  method: "GET" | "POST" | "PUT" | "DELETE";
  route: string;
  payload: any;
};

export type GeoPoint = {
  lat: number;
  lng: number;
};
