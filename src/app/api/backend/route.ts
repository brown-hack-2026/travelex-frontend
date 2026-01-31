import { BackendPayload } from "@/utils/types";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const payload: BackendPayload | undefined = await request.json();

  if (!payload) {
    return NextResponse.json({ message: "Invalid request" }, { status: 500 });
  }

  return await fetch(process.env.BACKEND_URL + payload.route, {
    method: payload.method,
    body: JSON.stringify(payload.payload),
  });
}
