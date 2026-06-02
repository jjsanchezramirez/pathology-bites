import { NextResponse } from "next/server";

// RFC 9116 security.txt — tells security researchers how to report vulnerabilities.
// Served at /.well-known/security.txt. `Expires` is required and must be a future date; we
// compute it per request (force-dynamic) so it auto-renews and never goes stale.
export const dynamic = "force-dynamic";

const SITE = "https://pathologybites.com";

export function GET() {
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  const body =
    [
      "Contact: mailto:contact@pathologybites.com",
      `Contact: ${SITE}/contact`,
      `Expires: ${expires}`,
      "Preferred-Languages: en",
      `Canonical: ${SITE}/.well-known/security.txt`,
    ].join("\n") + "\n";

  return new NextResponse(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=86400",
    },
  });
}
