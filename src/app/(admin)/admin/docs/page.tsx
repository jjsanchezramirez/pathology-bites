"use client";

import dynamic from "next/dynamic";
import "swagger-ui-react/swagger-ui.css";

const SwaggerUI = dynamic<{ url: string }>(() => import("swagger-ui-react"), { ssr: false });

export default function ApiDocsPage() {
  return (
    <div className="h-full w-full">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">API Documentation</h1>
        <p className="text-muted-foreground mt-2">
          Interactive API documentation for Pathology Bites endpoints
        </p>
      </div>
      <div className="border rounded-lg overflow-hidden bg-background">
        <SwaggerUI url="/api/docs" />
      </div>
    </div>
  );
}
