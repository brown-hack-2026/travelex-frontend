export type BackendPayload = {
  method: "GET" | "POST" | "PUT" | "DELETE";
  route: string;
  payload: any;
};
