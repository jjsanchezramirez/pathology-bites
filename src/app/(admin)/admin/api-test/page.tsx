"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { PageHeader } from "@/shared/components/ui/page-header";
import { ContentGrid, PageContainer, SectionCard } from "@/shared/components/ui/page-layout";
import { Button } from "@/shared/components/ui/button";

interface ApiResponse {
  status: number;
  statusText: string;
  time: string;
  data: unknown;
}

export default function ApiTestPage() {
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const testApi = async (endpoint: string) => {
    setLoading(true);
    setError(null);
    setResponse(null);

    const startTime = performance.now();

    try {
      const res = await fetch(endpoint);
      const endTime = performance.now();
      const data = await res.json();

      setResponse({
        status: res.status,
        statusText: res.statusText,
        time: `${Math.round(endTime - startTime)}ms`,
        data,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="API Testing Dashboard"
        description="Hit admin endpoints and inspect the raw response."
      />

      <ContentGrid>
        <SectionCard title="Admin APIs">
          <Button
            onClick={() => testApi("/api/admin/system-status")}
            disabled={loading}
            className="w-full"
          >
            Test System Status API
          </Button>
        </SectionCard>

        <SectionCard title="Dashboard APIs">
          <Button
            onClick={() => testApi("/api/admin/dashboard/stats")}
            disabled={loading}
            className="w-full"
          >
            Test Dashboard Stats API
          </Button>
        </SectionCard>
      </ContentGrid>

      {loading && (
        <SectionCard>
          <div className="flex items-center justify-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-sm">Loading...</span>
          </div>
        </SectionCard>
      )}

      {error && (
        <SectionCard title="Error" className="border-destructive/50">
          <pre className="overflow-auto rounded-md bg-destructive/10 p-4 text-xs text-destructive">
            {error}
          </pre>
        </SectionCard>
      )}

      {response && (
        <SectionCard
          title="Response"
          actions={<span className="text-sm text-muted-foreground">{response.time}</span>}
        >
          <div className="space-y-2">
            <p className="text-sm font-medium">Status</p>
            <p
              className={
                response.status === 200
                  ? "text-sm text-green-600 dark:text-green-400"
                  : "text-sm text-red-600 dark:text-red-400"
              }
            >
              {response.status} {response.statusText}
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Data</p>
            <pre className="max-h-96 overflow-auto rounded-md bg-muted p-4 text-xs">
              {JSON.stringify(response.data, null, 2)}
            </pre>
          </div>
        </SectionCard>
      )}

      <SectionCard title="Instructions">
        <p className="text-sm text-muted-foreground">
          Click any button above to test the corresponding API endpoint.
        </p>
        <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
          <li>Response time is measured in milliseconds</li>
          <li>Green status = successful (200)</li>
          <li>Red status = error (4xx/5xx)</li>
          <li>Check browser console for detailed logs</li>
        </ul>
      </SectionCard>
    </PageContainer>
  );
}
