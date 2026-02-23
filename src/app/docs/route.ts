import { ApiReference } from "@scalar/nextjs-api-reference";

const config = {
  url: "/api/docs",
  theme: "purple" as const,
  layout: "modern" as const,
  darkMode: true,
  hideModels: false,
  hideDownloadButton: false,
  searchHotKey: "k" as const,
  metadata: {
    title: "API Documentation | Pathology Bites",
  },
};

export const GET = ApiReference(config);
