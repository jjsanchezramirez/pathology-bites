"use client";

import dynamic from "next/dynamic";
import { ASK_ALBRIGHT_ENABLED } from "../lib/enabled";

// The launcher (~1k lines + the animated avatar) is code-split and mounts
// after hydration, like DemoQuestion: nothing of it is on the homepage's
// critical path. It makes no request until the visitor reaches for it.
const AskAlbrightLauncher = dynamic(
  () => import("./ask-albright-launcher").then((m) => m.AskAlbrightLauncher),
  { ssr: false }
);

/** Ask Dr. Albright on the homepage: a few free questions, then sign up. */
export function HomepageAskAlbright() {
  return ASK_ALBRIGHT_ENABLED ? <AskAlbrightLauncher variant="public" /> : null;
}
