// src/shared/components/common/cookie-consent-banner.tsx
"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { X, Cookie } from "lucide-react";
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
  // Embedded lesson players (/embed/*) live inside other sites' pages: no banner there.
  const embedded = usePathname()?.startsWith("/embed/") ?? false;

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

  if (!open || embedded) return null;

  return (
    <div
      className="fixed bottom-4 left-4 z-[100] pointer-events-none max-w-xs"
      data-testid="cookie-banner"
    >
      <Card
        role="dialog"
        aria-modal="false"
        aria-labelledby="cookie-banner-title"
        aria-describedby="cookie-banner-text"
        className="pointer-events-auto animate-in slide-in-from-left duration-500 shadow-2xl border border-border bg-card"
      >
        <div className="p-4">
          <div className="space-y-3">
            {/* Header with close button */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-full bg-primary/10 shrink-0">
                  <Cookie className="h-4 w-4 text-primary" />
                </div>
                <h3 id="cookie-banner-title" className="text-base font-bold">
                  Take a bite of our cookies
                </h3>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => choose("denied")}
                className="shrink-0 h-6 w-6"
                aria-label="Close and decline analytics cookies"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>

            {/* Description */}
            <p id="cookie-banner-text" className="text-xs text-muted-foreground leading-relaxed">
              We use cookies to keep you logged in. With your OK, we also use Google Analytics to
              improve your learning experience.
            </p>

            {/* Actions */}
            <div className="flex flex-col gap-1.5">
              <Button
                onClick={() => choose("granted")}
                className="w-full bg-primary hover:bg-primary/90 text-xs h-8"
                size="sm"
              >
                Accept
              </Button>
              <Button
                onClick={() => choose("denied")}
                variant="outline"
                className="w-full text-xs h-7"
                size="sm"
              >
                Decline
              </Button>
            </div>

            {/* Privacy Policy and Terms links */}
            <p className="text-[10px] text-muted-foreground">
              <a href="/privacy#cookies" className="text-primary hover:underline font-medium">
                Privacy Policy
              </a>
              {" • "}
              <a href="/terms" className="text-primary hover:underline font-medium">
                Terms
              </a>
            </p>
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
