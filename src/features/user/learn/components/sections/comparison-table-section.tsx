"use client";

import { ComparisonTableSection as ComparisonTableSectionType } from "../../types";

interface ComparisonTableSectionProps {
  section: ComparisonTableSectionType;
}

export function ComparisonTableSection({ section }: ComparisonTableSectionProps) {
  return (
    <div className="space-y-2">
      {section.heading && (
        <h2 className="text-2xl font-bold tracking-tight">{section.heading}</h2>
      )}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              {section.headers.map((header, i) => (
                <th
                  key={i}
                  className="px-4 py-3 text-left font-semibold"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {section.rows.map((row, i) => (
              <tr key={i} className="border-b last:border-0">
                {row.map((cell, j) => (
                  <td
                    key={j}
                    className={`px-4 py-3 ${j === 0 ? "font-medium" : ""}`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
