"use client";

import { KeyPointsSection as KeyPointsSectionType } from "../../types";
import { Lightbulb } from "lucide-react";

interface KeyPointsSectionProps {
  section: KeyPointsSectionType;
}

export function KeyPointsSection({ section }: KeyPointsSectionProps) {
  return (
    <div className="rounded-lg border bg-primary/5 p-6">
      <div className="flex items-center gap-2 mb-3">
        <Lightbulb className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">
          {section.heading || "Key Points"}
        </h3>
      </div>
      <ul className="space-y-2">
        {section.points.map((point, i) => (
          <li key={i} className="flex items-start gap-2 text-base leading-relaxed">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            {point}
          </li>
        ))}
      </ul>
    </div>
  );
}
