// src/shared/components/common/cookie-consent-banner.tsx
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { X } from "lucide-react";
import {
  OPEN_COOKIE_SETTINGS_EVENT,
  openCookieSettings,
  readConsent,
  saveConsent,
  type ConsentChoice,
} from "@/shared/utils/cookie-consent";

/** Short pause so the banner doesn't flash in during the first paint. */
export const BANNER_DELAY_MS = 500;

/**
 * Asks once whether Google Analytics may be used, then stays away.
 * The choice is kept in a first-party cookie (see utils/cookie-consent.ts),
 * so it survives reloads, navigation, sign-in and sign-out.
 * "Cookie settings" in the footer and on the privacy page reopens it.
 */
export function CookieConsentBanner() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (readConsent() === null) {
      timer = setTimeout(() => setOpen(true), BANNER_DELAY_MS);
    }
    const reopen = () => {
      if (timer) clearTimeout(timer);
      setOpen(true);
    };
    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, reopen);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, reopen);
    };
  }, []);

  const choose = (choice: ConsentChoice) => {
    saveConsent(choice);
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div
      className="fixed bottom-4 left-4 right-4 sm:right-auto z-[100] pointer-events-none sm:max-w-xs"
      data-testid="cookie-banner"
    >
      <Card
        role="dialog"
        aria-modal="false"
        aria-labelledby="cookie-banner-title"
        aria-describedby="cookie-banner-text"
        className="pointer-events-auto animate-in slide-in-from-bottom-4 duration-300 shadow-lg border border-border bg-card"
      >
        <div className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <h2 id="cookie-banner-title" className="text-base font-semibold">
              Cookies
            </h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => choose("denied")}
              className="shrink-0 h-7 w-7 -mt-1 -mr-1"
              aria-label="Close and decline analytics cookies"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <p id="cookie-banner-text" className="text-sm text-muted-foreground leading-relaxed">
            We use essential cookies to keep you signed in. With your OK, we also use Google
            Analytics to see which pages help most.{" "}
            <a href="/privacy#cookies" className="text-primary hover:underline">
              Privacy Policy
            </a>
          </p>

          <div className="flex gap-2">
            <Button onClick={() => choose("granted")} className="flex-1 h-9" size="sm">
              Accept
            </Button>
            <Button
              onClick={() => choose("denied")}
              variant="outline"
              className="flex-1 h-9"
              size="sm"
            >
              Decline
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

/** Small text button that reopens the banner so a visitor can change their choice. */
export function CookieSettingsButton({ className }: { className?: string }) {
  return (
    <button type="button" onClick={openCookieSettings} className={className}>
      Cookie settings
    </button>
  );
}
