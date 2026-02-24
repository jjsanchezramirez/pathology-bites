// Example: How to add caching to system-status API
// This would reduce the 9.5s to ~50ms for cached requests

import { NextResponse } from "next/server";

// Simple in-memory cache
let cachedResponse: any = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 60000; // 60 seconds

export async function GET(request: Request) {
  const now = Date.now();

  // Return cached response if fresh
  if (cachedResponse && (now - cacheTimestamp) < CACHE_DURATION) {
    console.log("[System Status] Returning cached response");
    return NextResponse.json({
      ...cachedResponse,
      fromCache: true,
      cacheAge: Math.round((now - cacheTimestamp) / 1000),
    });
  }

  // Fetch fresh data
  console.log("[System Status] Fetching fresh data");
  const data = await fetchSystemStatus(); // Your existing logic

  // Update cache
  cachedResponse = data;
  cacheTimestamp = now;

  return NextResponse.json({ ...data, fromCache: false });
}

// Alternative: Use Next.js built-in caching
export async function GET_WITH_NEXT_CACHE(request: Request) {
  const data = await fetchSystemStatus();

  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30'
    }
  });
}
