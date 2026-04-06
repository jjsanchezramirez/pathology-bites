"use client";

import { TextSection as TextSectionType } from "../../types";

interface TextSectionProps {
  section: TextSectionType;
}

export function TextSection({ section }: TextSectionProps) {
  return (
    <div className="space-y-4">
      {section.heading && (
        <h2 className="text-2xl font-bold tracking-tight">{section.heading}</h2>
      )}
      {section.blocks.map((block, i) => {
        const emphasisClass =
          block.emphasis === "highlight"
            ? "bg-yellow-50 dark:bg-yellow-950/30 border-l-4 border-yellow-400 pl-4 py-2"
            : block.emphasis === "warning"
              ? "bg-red-50 dark:bg-red-950/30 border-l-4 border-red-400 pl-4 py-2"
              : "";

        switch (block.type) {
          case "heading":
            return (
              <h3 key={i} className={`text-xl font-semibold ${emphasisClass}`}>
                {block.content}
              </h3>
            );
          case "list":
            return (
              <ul key={i} className={`list-disc pl-6 space-y-1 ${emphasisClass}`}>
                {(block.listItems || []).map((item, j) => (
                  <li key={j} className="text-base leading-relaxed">
                    {item}
                  </li>
                ))}
              </ul>
            );
          case "paragraph":
          default:
            return (
              <p key={i} className={`text-base leading-relaxed ${emphasisClass}`}>
                {block.content}
              </p>
            );
        }
      })}
    </div>
  );
}
