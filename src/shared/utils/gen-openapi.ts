// Generate the OpenAPI spec to /tmp/pb-openapi.json from the `@swagger` JSDoc on each API route
// (via getApiDocs → next-swagger-doc). Consumed by the pathology-bites-docs deploy
// (its scripts/sync-openapi.mjs runs this) to bundle a fresh API reference on every docs deploy.
// Run from the main app root: `npm run gen:openapi` (or `tsx src/shared/utils/gen-openapi.ts`).
import { writeFileSync } from "node:fs";
import { log } from "@/shared/utils/logging";

async function main() {
  process.env.NEXT_PUBLIC_SITE_URL ||= "https://pathologybites.com";
  // Dynamic import keeps tsx's named-export resolution happy across the transpile boundary.
  const { getApiDocs } = await import("../config/swagger");
  const spec = (await getApiDocs()) as { paths?: Record<string, unknown> };
  const out = "/tmp/pb-openapi.json";
  writeFileSync(out, JSON.stringify(spec, null, 2));
  log.info(`wrote ${out} — ${Object.keys(spec.paths ?? {}).length} paths`);
}

main().catch((err) => {
  log.error(err);
  process.exit(1);
});
