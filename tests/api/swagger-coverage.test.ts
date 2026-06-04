import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import path from "path";

/**
 * Guard: every API route under src/app/api must carry an `@swagger` JSDoc block
 * so the auto-generated OpenAPI spec (next-swagger-doc → /docs Scalar UI) stays
 * complete. Routes drift out of the docs silently otherwise.
 *
 * Excluded: `debug/` (dev-only, gitignored in production) and `docs/` (the spec
 * endpoint and Scalar renderer themselves).
 */

const API_DIR = path.resolve(__dirname, "../../src/app/api");
const EXCLUDED_SEGMENTS = ["debug", "docs"];

function findRouteFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDED_SEGMENTS.includes(entry.name)) continue;
      out.push(...findRouteFiles(full));
    } else if (entry.name === "route.ts" || entry.name === "route.tsx") {
      out.push(full);
    }
  }
  return out;
}

describe("API swagger coverage", () => {
  const routeFiles = findRouteFiles(API_DIR);

  it("finds API route files to check", () => {
    expect(routeFiles.length).toBeGreaterThan(0);
  });

  it("every non-debug route declares an @swagger block", () => {
    const undocumented = routeFiles
      .filter((file) => !readFileSync(file, "utf8").includes("@swagger"))
      .map((file) => path.relative(API_DIR, file));

    expect(
      undocumented,
      `Routes missing an @swagger JSDoc block (add one or run /docs to see the gap):\n` +
        undocumented.map((r) => `  - ${r}`).join("\n")
    ).toEqual([]);
  });
});
