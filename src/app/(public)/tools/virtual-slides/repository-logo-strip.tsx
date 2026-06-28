"use client";

import { repositoryLogos } from "@/shared/components/common/repository-logos";
import { getR2PublicUrl } from "@/shared/services/r2-storage";
import { chunkLogosIntoRows } from "./virtual-slides-utils";

export function RepositoryLogoStrip() {
  return (
    <section className="py-4 md:py-6 hidden sm:block">
      <div className="container px-4 mx-auto max-w-6xl">
        <div className="flex flex-col items-center gap-y-3">
          {chunkLogosIntoRows(repositoryLogos).map((rowLogos, ri) => (
            <div key={ri} className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
              {rowLogos.map((repo) => (
                <a
                  key={repo.id}
                  href={repo.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={repo.alt}
                  className="group flex items-center justify-center"
                >
                  <picture>
                    <source
                      srcSet={getR2PublicUrl(
                        `logos/optimized/${repo.file.replace(/\.png$/, ".avif")}`
                      )}
                      type="image/avif"
                    />
                    {}
                    <img
                      src={getR2PublicUrl(`logos/optimized/${repo.file}`)}
                      alt={repo.alt}
                      width={90}
                      height={36}
                      loading="lazy"
                      decoding="async"
                      className="object-contain opacity-60 grayscale transition-all duration-200 hover:scale-105 group-hover:opacity-100 group-hover:grayscale-0"
                    />
                  </picture>
                </a>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
