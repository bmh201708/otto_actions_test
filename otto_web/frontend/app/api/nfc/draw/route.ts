import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const upstreamUrl = new URL("/api/public/nfc/draw", API_BASE);

  const tag = url.searchParams.get("tag");
  const seed = url.searchParams.get("seed");
  const index = url.searchParams.get("index");

  if (tag) upstreamUrl.searchParams.set("tag", tag);
  if (seed) upstreamUrl.searchParams.set("seed", seed);
  if (index) upstreamUrl.searchParams.set("index", index);

  const response = await fetch(upstreamUrl.toString(), {
    cache: "no-store"
  });

  const body = await response.text();

  return new NextResponse(body, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("content-type") ?? "application/json",
      "Cache-Control": "no-store"
    }
  });
}
