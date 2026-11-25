// Security tests for the identity headers and role source in src/middleware.ts.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

type FakeUser = {
  id: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
} | null;
let currentUser: FakeUser = null;

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser: async () => ({ data: { user: currentUser } }) },
  }),
}));

const { middleware } = await import("@/middleware");

function req(path: string, headers: Record<string, string> = {}) {
  return new NextRequest(new URL(path, "https://www.pathologybites.com"), { headers });
}
// NextResponse.next({ request: { headers } }) forwards each header as x-middleware-request-<name>.
const forwarded = (res: Response, name: string) => res.headers.get(`x-middleware-request-${name}`);

describe("middleware identity headers", () => {
  beforeEach(() => {
    currentUser = null;
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
  });

  it("strips client-supplied identity headers on public API routes", async () => {
    const res = await middleware(
      req("/api/public/tools/virtual-slides/wsi-related", {
        "x-user-id": "forged",
        "x-user-role": "admin",
      })
    );
    // Without an explicit override list, Next passes the ORIGINAL headers (forged ones
    // included) to the handler; with one, only the listed headers reach it.
    const override = res.headers.get("x-middleware-override-headers");
    expect(override).not.toBeNull();
    expect(override!.split(",")).not.toContain("x-user-id");
    expect(override!.split(",")).not.toContain("x-user-role");
    expect(forwarded(res, "x-user-id")).toBeNull();
    expect(forwarded(res, "x-user-role")).toBeNull();
  });

  it("ignores a role in user_metadata and a forged role header", async () => {
    currentUser = { id: "u1", app_metadata: { role: "user" }, user_metadata: { role: "admin" } };
    const res = await middleware(req("/api/user/favorites", { "x-user-role": "admin" }));
    expect(forwarded(res, "x-user-id")).toBe("u1");
    expect(forwarded(res, "x-user-role")).toBe("user");
  });

  it("forwards no role when app_metadata has none, even if the client sends one", async () => {
    currentUser = { id: "u2", user_metadata: { role: "admin" } };
    const res = await middleware(req("/api/user/favorites", { "x-user-role": "admin" }));
    expect(forwarded(res, "x-user-id")).toBe("u2");
    expect(forwarded(res, "x-user-role")).toBeNull();
  });

  it("returns 403 on /api/admin for a plain user who claims admin in user_metadata", async () => {
    currentUser = { id: "u3", app_metadata: { role: "user" }, user_metadata: { role: "admin" } };
    const res = await middleware(req("/api/admin/questions/create", { "x-user-role": "admin" }));
    expect(res.status).toBe(403);
  });

  it("lets an admin (app_metadata) through to /api/admin with the trusted role", async () => {
    currentUser = { id: "a1", app_metadata: { role: "admin" } };
    const res = await middleware(req("/api/admin/questions/create"));
    expect(res.status).toBe(200);
    expect(forwarded(res, "x-user-role")).toBe("admin");
  });

  it("redirects a user_metadata-only 'admin' away from /admin pages", async () => {
    currentUser = { id: "u4", app_metadata: { role: "user" }, user_metadata: { role: "admin" } };
    const res = await middleware(req("/admin/questions"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/dashboard");
  });

  it("strips a forged permissions header on public API routes", async () => {
    const res = await middleware(
      req("/api/public/tools/virtual-slides/wsi-related", {
        "x-user-permissions": "create_questions",
      })
    );
    expect(forwarded(res, "x-user-permissions")).toBeNull();
  });

  it("forwards permissions from app_metadata only, ignoring user_metadata and forgeries", async () => {
    currentUser = {
      id: "w1",
      app_metadata: { role: "user", permissions: ["create_questions", "bogus"] },
      user_metadata: { permissions: ["review_questions"] },
    };
    const res = await middleware(
      req("/api/admin/questions/create", { "x-user-permissions": "review_questions" })
    );
    expect(res.status).toBe(200);
    expect(forwarded(res, "x-user-permissions")).toBe("create_questions");
  });

  it("returns 403 on /api/admin for a user holding no permission", async () => {
    currentUser = { id: "u5", app_metadata: { role: "user", permissions: [] } };
    const res = await middleware(req("/api/admin/questions/reviewers"));
    expect(res.status).toBe(403);
  });

  it("lets a permission holder into /admin but not admin-only or other-permission pages", async () => {
    currentUser = { id: "r1", app_metadata: { role: "user", permissions: ["review_questions"] } };
    expect((await middleware(req("/admin/review-queue"))).status).toBe(200);
    for (const path of ["/admin/users", "/admin/questions/create", "/admin/my-questions"]) {
      const res = await middleware(req(path));
      expect(res.status).toBe(307);
      expect(new URL(res.headers.get("location")!).pathname).toBe("/admin");
    }
  });

  it("returns 401 on private APIs without a session", async () => {
    const res = await middleware(req("/api/admin/questions/create"));
    expect(res.status).toBe(401);
  });
});
