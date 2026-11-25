import { Antic, Architects_Daughter } from "next/font/google";

// Fonts referenced by dashboard theme variables (see dashboard-themes.ts).
// Loading via next/font self-hosts via Vercel, removes the render-blocking
// Google Fonts stylesheet on public pages, and exposes CSS variables
// so theme variables can reference them.

// "notebook" theme
export const architectsDaughter = Architects_Daughter({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-architects-daughter",
  display: "swap",
});

// "sage-garden" theme
export const antic = Antic({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-antic",
  display: "swap",
  preload: false,
});
