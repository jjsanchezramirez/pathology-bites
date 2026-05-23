"use client";

import { getR2PublicUrl } from "@/shared/services/r2-storage";

// Logos served from `logos/optimized/` — downsized to 240×176 (2× of the
// ~120×88 display box). AVIF is the primary source; PNG is the legacy
// fallback. Originals in `logos/` remain at 912×672 for any other use.
type Logo = { id: string; file: string; alt: string; href: string };

const LOGOS_PREFIX = "logos/optimized";

function avifSrc(file: string): string {
  return getR2PublicUrl(`${LOGOS_PREFIX}/${file.replace(/\.png$/, ".avif")}`);
}

function pngSrc(file: string): string {
  return getR2PublicUrl(`${LOGOS_PREFIX}/${file}`);
}

// Repository logos. hrefs point at each repository's home domain
// (derived from the dataset base URLs). Exported for reuse (e.g. the static
// strip on the virtual-slides page).
export const repositoryLogos: Logo[] = [
  {
    id: "leeds",
    file: "university-of-leeds-logo.png",
    alt: "University of Leeds",
    href: "https://www.virtualpathology.leeds.ac.uk/",
  },
  {
    id: "pathpresenter",
    file: "path-presenter-logo.png",
    alt: "PathPresenter",
    href: "https://pathpresenter.net/",
  },
  {
    id: "mgh",
    file: "mgh-logo.png",
    alt: "MGH Pathology",
    href: "https://learn.mghpathology.org/",
  },
  {
    id: "toronto",
    file: "university-of-toronto-logo.png",
    alt: "University of Toronto LMP",
    href: "https://dlm.lmp.utoronto.ca/",
  },
  {
    id: "rosai",
    file: "rosai-collection-logo.png",
    alt: "Rosai Collection",
    href: "https://rosaicollection.net/",
  },
  {
    id: "hematopathology",
    file: "hematopathology-etutorial-logo.png",
    alt: "Hematopathology eTutorial",
    href: "https://www.hematopathologyetutorial.com/",
  },
  {
    id: "recut",
    file: "recut-club-logo.png",
    alt: "Recut Club",
    href: "https://recutclub.com/",
  },
  {
    id: "stjude",
    file: "st-jude-logo.png",
    alt: "St. Jude Cloud",
    href: "https://pecan.stjude.cloud/",
  },
  {
    id: "who",
    file: "who-logo.png",
    alt: "WHO Blue Books Online",
    href: "https://tumourclassification.iarc.who.int/",
  },
  {
    id: "aanp",
    file: "aanp-logo.png",
    alt: "AANP Diagnostic Slide Session",
    href: "https://neuro2.pathology.pitt.edu/",
  },
];

const DEFAULT_ROWS = 3;
// Copies of each row laid end-to-end. The track scrolls by exactly one copy
// (-100% / REPEAT) so the loop is seamless regardless of how many logos a row
// has. 4 copies guarantees the track always overflows the viewport.
const REPEAT = 4;

/**
 * Repository logo wall — each row is an infinite horizontal marquee. Rows
 * alternate scroll direction and speed; logos render grayscale and resolve to
 * full color while the row is paused on hover.
 *
 * @param rows  Number of marquee rows; logos are round-robin split across them.
 */
export function RepositoryLogos({ rows = DEFAULT_ROWS }: { rows?: number }) {
  // Round-robin split so each row gets a varied, evenly sized subset.
  const rowGroups: Logo[][] = Array.from({ length: rows }, (_, r) =>
    repositoryLogos.filter((_, i) => i % rows === r)
  );

  return (
    <div>
      <div className="space-y-4">
        {rowGroups.map((rowLogos, rowIndex) => (
          <div
            key={rowIndex}
            className="marquee-row overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]"
          >
            <div
              className="marquee-track flex w-max"
              style={{
                animationName: "pb-marquee",
                animationDuration: `${40 + rowIndex * 6}s`,
                animationTimingFunction: "linear",
                animationIterationCount: "infinite",
                animationDirection: rowIndex % 2 === 1 ? "reverse" : "normal",
              }}
            >
              {Array.from({ length: REPEAT }).flatMap((_, copy) =>
                rowLogos.map((logo) => (
                  <a
                    key={`${copy}-${logo.id}`}
                    href={logo.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={logo.alt}
                    aria-hidden={copy > 0}
                    tabIndex={copy > 0 ? -1 : undefined}
                    className="group mr-4 flex h-20 w-40 flex-shrink-0 items-center justify-center rounded-xl border bg-white p-4 shadow-sm transition-shadow duration-200 hover:shadow-lg"
                  >
                    <picture>
                      <source srcSet={avifSrc(logo.file)} type="image/avif" />
                      {}
                      <img
                        src={pngSrc(logo.file)}
                        alt={logo.alt}
                        width={120}
                        height={48}
                        loading="lazy"
                        decoding="async"
                        className="object-contain opacity-60 grayscale transition-all duration-300 group-hover:opacity-100 group-hover:grayscale-0"
                      />
                    </picture>
                  </a>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes pb-marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-${100 / REPEAT}%); }
        }
        .marquee-row:hover .marquee-track {
          animation-play-state: paused;
        }
        @media (prefers-reduced-motion: reduce) {
          .marquee-track { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
