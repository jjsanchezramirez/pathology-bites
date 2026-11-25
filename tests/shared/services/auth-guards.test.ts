import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AuthTimeoutError,
  boundedLock,
  clearLocalAuthStorage,
  withTimeout,
} from "@/shared/services/auth-guards";

type Opts = { ifAvailable?: boolean; signal?: AbortSignal };

/** A LockManager where `held` names are taken by another tab and never released. */
function fakeLocks(held: string[]) {
  return {
    request: (name: string, opts: Opts, cb: (lock: { name: string } | null) => unknown) => {
      if (!held.includes(name)) return Promise.resolve(cb({ name }));
      if (opts.ifAvailable) return Promise.resolve(cb(null));
      return new Promise((_, reject) =>
        opts.signal?.addEventListener("abort", () =>
          reject(new DOMException("The request was aborted.", "AbortError"))
        )
      );
    },
  };
}

function useLocks(held: string[]) {
  vi.stubGlobal("navigator", { ...navigator, locks: fakeLocks(held) });
}

afterEach(() => vi.unstubAllGlobals());

describe("boundedLock", () => {
  it("runs fn under the lock when it is free", async () => {
    useLocks([]);
    await expect(boundedLock("sb-auth", -1, async () => "ok", 20)).resolves.toBe("ok");
  });

  it("gives up on a lock another tab never releases and runs fn anyway", async () => {
    useLocks(["sb-auth"]);
    const fn = vi.fn(async () => "ran");
    await expect(boundedLock("sb-auth", -1, fn, 20)).resolves.toBe("ran");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("keeps Supabase's immediate-fail behaviour for acquireTimeout 0", async () => {
    useLocks(["sb-auth"]);
    await expect(boundedLock("sb-auth", 0, async () => "x", 20)).rejects.toThrow(
      /immediately failed/
    );
  });

  it("rethrows an AbortError from fn itself without running it twice", async () => {
    useLocks([]);
    const fn = vi.fn(async () => {
      throw new DOMException("fetch aborted", "AbortError");
    });
    await expect(boundedLock("sb-auth", -1, fn, 20)).rejects.toThrow("fetch aborted");
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe("withTimeout", () => {
  it("passes through a value that arrives in time", async () => {
    await expect(withTimeout(Promise.resolve(1), 50, "x")).resolves.toBe(1);
  });
  it("rejects with AuthTimeoutError when the promise never settles", async () => {
    await expect(withTimeout(new Promise(() => {}), 20, "Session check")).rejects.toBeInstanceOf(
      AuthTimeoutError
    );
  });
});

describe("clearLocalAuthStorage", () => {
  it("removes sb-* cookies and storage keys and the auth cache, nothing else", () => {
    document.cookie = "sb-abc-auth-token=stale; path=/";
    document.cookie = "theme=dark; path=/";
    localStorage.setItem("sb-abc-auth-token", "x");
    localStorage.setItem("keep", "1");
    sessionStorage.setItem("auth-state", "{}");
    clearLocalAuthStorage();
    expect(document.cookie).not.toContain("sb-abc-auth-token");
    expect(document.cookie).toContain("theme=dark");
    expect(localStorage.getItem("sb-abc-auth-token")).toBeNull();
    expect(localStorage.getItem("keep")).toBe("1");
    expect(sessionStorage.getItem("auth-state")).toBeNull();
  });
});
