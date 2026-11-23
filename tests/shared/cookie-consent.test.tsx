/**
 * Cookie consent: the banner must ask once, remember the answer, and gate
 * Google Analytics.
 *
 * The bug this pins (Nov 2026): consent was saved in localStorage under
 * "pathology-bites-cookie-consent". The unified cache had a "cookie"
 * namespace ("pathology-bites-cookie-*") whose start-up cleanup deleted any
 * key in it that wasn't a v3 cache entry, so the saved choice was wiped on
 * every full page load and the banner came back every visit. Sign-out's
 * localStorage.clear() wiped it too.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";

vi.mock("@/shared/utils/logging", () => ({
  log: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));
// Render next/script as a marker so we can see whether GA would load.
vi.mock("next/script", () => ({
  default: ({ id, src }: { id?: string; src?: string }) => (
    <span data-testid="next-script" data-id={id ?? ""} data-src={src ?? ""} />
  ),
}));
vi.mock("@vercel/analytics/react", () => ({ Analytics: () => null }));
vi.mock("@vercel/speed-insights/next", () => ({ SpeedInsights: () => null }));

import {
  CONSENT_CHANGED_EVENT,
  CONSENT_COOKIE,
  CONSENT_VERSION,
  LEGACY_CONSENT_KEY,
  parseConsentCookie,
  readConsent,
  saveConsent,
  openCookieSettings,
} from "@/shared/utils/cookie-consent";
import {
  BANNER_DELAY_MS,
  CookieConsentBanner,
  CookieSettingsButton,
} from "@/shared/components/common/cookie-consent-banner";

function clearAllCookies() {
  document.cookie
    .split(";")
    .map((c) => c.trim().split("=")[0])
    .filter(Boolean)
    .forEach((name) => {
      document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    });
}

function consentCookie(): string | null {
  const m = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${CONSENT_COOKIE}=`));
  return m ? decodeURIComponent(m.slice(CONSENT_COOKIE.length + 1)) : null;
}

/** Mount the banner the way a fresh page load does and let its delay pass. */
function loadPage() {
  const view = render(<CookieConsentBanner />);
  act(() => {
    vi.advanceTimersByTime(BANNER_DELAY_MS + 50);
  });
  return view;
}

const bannerShown = () => screen.queryByTestId("cookie-banner") !== null;

beforeEach(() => {
  vi.useFakeTimers();
  clearAllCookies();
  localStorage.clear();
  delete (window as { gtag?: unknown }).gtag;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("parseConsentCookie", () => {
  it("accepts the current version only", () => {
    expect(parseConsentCookie(`${CONSENT_VERSION}.granted`)).toBe("granted");
    expect(parseConsentCookie(`${CONSENT_VERSION}.denied`)).toBe("denied");
    expect(parseConsentCookie("1.granted")).toBeNull();
    expect(parseConsentCookie(`${CONSENT_VERSION}.maybe`)).toBeNull();
    expect(parseConsentCookie("")).toBeNull();
    expect(parseConsentCookie(null)).toBeNull();
    expect(parseConsentCookie("garbage")).toBeNull();
  });
});

describe("saveConsent / readConsent", () => {
  it("has no choice on a first visit", () => {
    expect(readConsent()).toBeNull();
  });

  it("stores the choice in a first-party cookie for a year", () => {
    const spy = vi.spyOn(document, "cookie", "set");
    saveConsent("granted");
    expect(readConsent()).toBe("granted");
    expect(consentCookie()).toBe(`${CONSENT_VERSION}.granted`);
    const written = spy.mock.calls.map((c) => c[0]).find((c) => c.startsWith(CONSENT_COOKIE));
    expect(written).toMatch(/path=\//);
    expect(written).toMatch(/max-age=31536000/);
    expect(written).toMatch(/SameSite=Lax/);
    spy.mockRestore();
  });

  it("can change from accept to decline and back", () => {
    saveConsent("granted");
    saveConsent("denied");
    expect(readConsent()).toBe("denied");
    saveConsent("granted");
    expect(readConsent()).toBe("granted");
  });

  it("survives localStorage.clear() (what sign-out and 'clear data' do)", () => {
    saveConsent("denied");
    localStorage.clear();
    sessionStorage.clear();
    expect(readConsent()).toBe("denied");
  });

  it("tells a loaded gtag and the page about the change", () => {
    const gtag = vi.fn();
    (window as unknown as { gtag: typeof gtag }).gtag = gtag;
    const heard: unknown[] = [];
    const onChange = (e: Event) => heard.push((e as CustomEvent).detail);
    window.addEventListener(CONSENT_CHANGED_EVENT, onChange);

    saveConsent("granted");
    saveConsent("denied");

    expect(gtag).toHaveBeenCalledWith("consent", "update", { analytics_storage: "granted" });
    expect(gtag).toHaveBeenCalledWith("consent", "update", { analytics_storage: "denied" });
    expect(heard).toEqual(["granted", "denied"]);
    window.removeEventListener(CONSENT_CHANGED_EVENT, onChange);
  });

  it("removes Google Analytics cookies when consent is withdrawn", () => {
    document.cookie = "_ga=GA1.1.123; path=/";
    document.cookie = "_ga_9PF68HPWH7=GS1.1.456; path=/";
    document.cookie = "sb-htsnkuudinrcgfqlqmpi-auth-token=keep; path=/";
    saveConsent("denied");
    expect(document.cookie).not.toMatch(/_ga=/);
    expect(document.cookie).not.toMatch(/_ga_9PF68HPWH7=/);
    // The sign-in cookie is essential and must not be touched.
    expect(document.cookie).toMatch(/sb-htsnkuudinrcgfqlqmpi-auth-token=keep/);
  });

  it("asks again after a policy version bump (old cookie value)", () => {
    document.cookie = `${CONSENT_COOKIE}=1.granted; path=/`;
    expect(readConsent()).toBeNull();
  });

  it("carries a choice from the old localStorage banner over to the cookie", () => {
    localStorage.setItem(
      LEGACY_CONSENT_KEY,
      JSON.stringify({ version: "1.0", essential: true, analytics: true, timestamp: "x" })
    );
    expect(readConsent()).toBe("granted");
    expect(consentCookie()).toBe(`${CONSENT_VERSION}.granted`);
    expect(localStorage.getItem(LEGACY_CONSENT_KEY)).toBeNull();

    clearAllCookies();
    localStorage.setItem(LEGACY_CONSENT_KEY, JSON.stringify({ analytics: false }));
    expect(readConsent()).toBe("denied");
  });

  it("treats a corrupt old localStorage value as no choice", () => {
    localStorage.setItem(LEGACY_CONSENT_KEY, "{not json");
    expect(readConsent()).toBeNull();
  });
});

describe("CookieConsentBanner", () => {
  it("does not flash in on the first paint, then shows on a first visit", () => {
    render(<CookieConsentBanner />);
    expect(bannerShown()).toBe(false);
    act(() => {
      vi.advanceTimersByTime(BANNER_DELAY_MS + 50);
    });
    expect(bannerShown()).toBe(true);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Accept")).toBeTruthy();
    expect(screen.getByText("Decline")).toBeTruthy();
  });

  it("Accept hides it and it stays hidden on reload", () => {
    const first = loadPage();
    fireEvent.click(screen.getByText("Accept"));
    expect(bannerShown()).toBe(false);
    expect(readConsent()).toBe("granted");
    first.unmount();

    loadPage(); // reload
    expect(bannerShown()).toBe(false);
  });

  it("Decline hides it and it stays hidden on reload", () => {
    const first = loadPage();
    fireEvent.click(screen.getByText("Decline"));
    expect(readConsent()).toBe("denied");
    first.unmount();

    loadPage();
    expect(bannerShown()).toBe(false);
  });

  it("the X declines and is remembered", () => {
    const first = loadPage();
    fireEvent.click(screen.getByLabelText("Close and decline analytics cookies"));
    expect(readConsent()).toBe("denied");
    first.unmount();
    loadPage();
    expect(bannerShown()).toBe(false);
  });

  it("stays hidden across many page loads", () => {
    const first = loadPage();
    fireEvent.click(screen.getByText("Accept"));
    first.unmount();
    for (let i = 0; i < 10; i++) {
      const page = loadPage();
      expect(bannerShown()).toBe(false);
      page.unmount();
    }
  });

  it("stays hidden after sign-out clears local storage", () => {
    const first = loadPage();
    fireEvent.click(screen.getByText("Accept"));
    first.unmount();

    // What profile-dropdown / sidebar sign-out do before redirecting to /login.
    const savedTheme = localStorage.getItem("pathology-bites-theme");
    localStorage.clear();
    sessionStorage.clear();
    if (savedTheme) localStorage.setItem("pathology-bites-theme", savedTheme);
    document.cookie = "admin-mode=; path=/; max-age=0";

    loadPage();
    expect(bannerShown()).toBe(false);
  });

  it("shows again only when the cookie is cleared", () => {
    const first = loadPage();
    fireEvent.click(screen.getByText("Decline"));
    first.unmount();

    clearAllCookies();
    loadPage();
    expect(bannerShown()).toBe(true);
  });

  it("does not show for a visitor who answered the old banner", () => {
    localStorage.setItem(
      LEGACY_CONSENT_KEY,
      JSON.stringify({ version: "1.0", essential: true, analytics: false, timestamp: "x" })
    );
    loadPage();
    expect(bannerShown()).toBe(false);
  });

  it("'Cookie settings' reopens it so the choice can be changed", () => {
    saveConsent("granted");
    render(
      <>
        <CookieConsentBanner />
        <CookieSettingsButton />
      </>
    );
    act(() => {
      vi.advanceTimersByTime(BANNER_DELAY_MS + 50);
    });
    expect(bannerShown()).toBe(false);

    fireEvent.click(screen.getByText("Cookie settings"));
    expect(bannerShown()).toBe(true);
    fireEvent.click(screen.getByText("Decline"));
    expect(bannerShown()).toBe(false);
    expect(readConsent()).toBe("denied");
  });

  it("openCookieSettings() reopens it before the first-visit delay ends", () => {
    render(<CookieConsentBanner />);
    act(() => openCookieSettings());
    expect(bannerShown()).toBe(true);
    fireEvent.click(screen.getByText("Accept"));
    act(() => {
      vi.advanceTimersByTime(BANNER_DELAY_MS + 50);
    });
    // The pending first-visit timer must not pop it back open.
    expect(bannerShown()).toBe(false);
  });

  it("unmounting before the delay ends leaves no stray timer", () => {
    const view = render(<CookieConsentBanner />);
    view.unmount();
    expect(() =>
      act(() => {
        vi.advanceTimersByTime(BANNER_DELAY_MS + 50);
      })
    ).not.toThrow();
  });

  it("links to the cookie section of the privacy policy", () => {
    loadPage();
    const link = screen.getByText("Privacy Policy") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/privacy#cookies");
  });
});

describe("Regression: the unified cache must not delete the saved choice", () => {
  it("starting the cache (every full page load) leaves consent alone", async () => {
    saveConsent("granted");
    // A visitor who answered the old banner still has this key until it migrates.
    localStorage.setItem(
      LEGACY_CONSENT_KEY,
      JSON.stringify({ version: "1.0", essential: true, analytics: true, timestamp: "x" })
    );
    vi.resetModules();
    const { unifiedCache, CACHE_NAMESPACES } = await import("@/shared/services/unified-cache");
    expect(unifiedCache).toBeTruthy();
    // No namespace may own the old consent key's prefix again.
    for (const ns of Object.values(CACHE_NAMESPACES)) {
      expect(LEGACY_CONSENT_KEY.startsWith(`pathology-bites-${ns.name}-`)).toBe(false);
    }
    expect(localStorage.getItem(LEGACY_CONSENT_KEY)).not.toBeNull();
    unifiedCache.clearAll();
    unifiedCache.cleanup();
    expect(localStorage.getItem(LEGACY_CONSENT_KEY)).not.toBeNull();
    expect(readConsent()).toBe("granted");
  });
});

describe("AnalyticsProvider gates Google Analytics on consent", () => {
  async function renderProvider() {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", "G-TEST123");
    const { AnalyticsProvider } = await import("@/shared/contexts/analytics-provider");
    return render(
      <AnalyticsProvider>
        <p>page</p>
      </AnalyticsProvider>
    );
  }
  const gaScripts = () =>
    screen
      .queryAllByTestId("next-script")
      .filter(
        (el) =>
          el.getAttribute("data-id") === "google-analytics" ||
          (el.getAttribute("data-src") ?? "").includes("googletagmanager")
      );

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does not load GA on a first visit (no choice yet)", async () => {
    await renderProvider();
    expect(screen.getByText("page")).toBeTruthy();
    expect(gaScripts()).toHaveLength(0);
  });

  it("does not load GA after Decline", async () => {
    saveConsent("denied");
    await renderProvider();
    expect(gaScripts()).toHaveLength(0);
  });

  it("loads GA after Accept, including on later page loads", async () => {
    saveConsent("granted");
    await renderProvider();
    expect(gaScripts()).toHaveLength(2);
  });

  it("loads GA the moment the visitor accepts, and drops it when they decline", async () => {
    await renderProvider();
    expect(gaScripts()).toHaveLength(0);
    act(() => saveConsent("granted"));
    expect(gaScripts()).toHaveLength(2);
    act(() => saveConsent("denied"));
    expect(gaScripts()).toHaveLength(0);
  });
});
