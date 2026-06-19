// OpenAPI spec definition for the platform API, built from the `@swagger` JSDoc on each route
// handler. Since the in-app /docs + /api/docs routes were removed, the only consumer is the
// docs-site spec generator (`dev/gen-openapi.mts`), which bundles the output into
// docs.pathologybites.com on each deploy. Kept here (tracked) so the API metadata is versioned.
import { createSwaggerSpec } from "next-swagger-doc";

export const getApiDocs = async () => {
  const spec = createSwaggerSpec({
    apiFolder: "src/app/api",
    definition: {
      openapi: "3.0.0",
      info: {
        title: "Pathology Bites API",
        version: "2026.06",
        description:
          "Internal API for the Pathology Bites platform. Auto-generated from `@swagger` JSDoc blocks on each route handler (next-swagger-doc). Most admin/user endpoints are gated by middleware that injects `x-user-id` / `x-user-role` headers from the Supabase session.",
      },
      servers: [
        {
          url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
          description: "API Server",
        },
      ],
      components: {
        securitySchemes: {
          BearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
      security: [],
    },
  });

  return spec;
};
