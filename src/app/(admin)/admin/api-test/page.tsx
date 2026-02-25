"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";

export default function ApiTestPage() {
  const [response, setResponse] = useState<any>(null);
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
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">API Testing Dashboard</h1>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Admin APIs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              onClick={() => testApi("/api/admin/system-status")}
              disabled={loading}
              className="w-full"
            >
              Test System Status API
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dashboard APIs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              onClick={() => testApi("/api/admin/dashboard/stats")}
              disabled={loading}
              className="w-full"
            >
              Test Dashboard Stats API
            </Button>
          </CardContent>
        </Card>
      </div>

      {loading && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-3">Loading...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-red-500">
          <CardHeader>
            <CardTitle className="text-red-600">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-red-50 p-4 rounded overflow-auto">{error}</pre>
          </CardContent>
        </Card>
      )}

      {response && (
        <Card>
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              <span>Response</span>
              <span className="text-sm font-normal text-muted-foreground">{response.time}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-semibold mb-2">Status:</p>
              <p className={response.status === 200 ? "text-green-600" : "text-red-600"}>
                {response.status} {response.statusText}
              </p>
            </div>

            <div>
              <p className="text-sm font-semibold mb-2">Data:</p>
              <pre className="bg-muted p-4 rounded overflow-auto text-xs max-h-96">
                {JSON.stringify(response.data, null, 2)}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Click any button above to test the corresponding API endpoint.
          </p>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
            <li>Response time is measured in milliseconds</li>
            <li>Green status = successful (200)</li>
            <li>Red status = error (4xx/5xx)</li>
            <li>Check browser console for detailed logs</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
