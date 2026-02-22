import { createSwaggerSpec } from "next-swagger-doc";

export const getApiDocs = async () => {
  const spec = createSwaggerSpec({
    apiFolder: "src/app/api",
    definition: {
      openapi: "3.0.0",
      info: {
        title: "Pathology Bites API",
        version: "1.0.0",
        description: "API documentation for Pathology Bites application",
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
