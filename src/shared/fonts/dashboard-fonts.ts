import { Architects_Daughter } from "next/font/google";

// Scoped to dashboard/admin layouts only — the "notebook" theme uses this font.
// Loading via next/font self-hosts via Vercel, removes the render-blocking
// Google Fonts stylesheet on public pages, and exposes `--font-architects-daughter`
// so theme variables can reference it.
export const architectsDaughter = Architects_Daughter({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-architects-daughter",
  display: "swap",
});
