/**
 * useR2Json must pass `resolveUrl` through to loadR2Json. It used to drop it,
 * so every hook consumer skipped its manifest and read the mutable fallback
 * key — which, fetched with `force-cache`, could stay stale after a republish.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useR2Json } from "@/shared/hooks/use-r2-json";

afterEach(() => vi.restoreAllMocks());

describe("useR2Json", () => {
  it("fetches the manifest-resolved URL, not the compiled fallback", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const { result } = renderHook(() =>
      useR2Json<{ ok: boolean }>({
        url: "https://data.example/x/fixed.json.br?case=resolve",
        resolveUrl: async () => "https://data.example/x/content-abc123.json.br",
        label: "test",
      })
    );
    await waitFor(() => expect(result.current.data).toEqual({ ok: true }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("https://data.example/x/content-abc123.json.br");
  });
});
