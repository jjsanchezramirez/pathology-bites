import localFont from "next/font/local";

// Typeface for script-lesson scenes (the templated lesson player). One family,
// two weights, bundled in the repo so lessons look the same everywhere and the
// build doesn't depend on reaching Google Fonts.
export const lessonSans = localFont({
  src: [
    {
      path: "./instrument-sans/InstrumentSans-Regular-latin.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "./instrument-sans/InstrumentSans-SemiBold-latin.woff2",
      weight: "600",
      style: "normal",
    },
  ],
  display: "swap",
  fallback: [
    "ui-sans-serif",
    "system-ui",
    "-apple-system",
    "Segoe UI",
    "Helvetica Neue",
    "sans-serif",
  ],
});
