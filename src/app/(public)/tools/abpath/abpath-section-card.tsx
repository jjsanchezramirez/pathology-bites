"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { ABPathSection, ABPathSubSection } from "@/shared/types/abpath";
import { ABPathItemView } from "./abpath-item-view";

interface ABPathSectionCardProps {
  section: ABPathSection;
  sectionIndex: number;
  expandedSections: Set<string>;
  onToggleSection: (sectionKey: string) => void;
}

export function ABPathSectionCard({
  section,
  sectionIndex,
  expandedSections,
  onToggleSection,
}: ABPathSectionCardProps) {
  return (
    <Card
      key={`section-${section.type}-${section.section}-${sectionIndex}`}
      className="overflow-hidden"
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <span className="px-2 py-1 rounded text-sm font-medium bg-primary/10 text-primary">
            {section.type.toUpperCase()} {section.section}
          </span>
          <span className="text-base">{section.title}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {section.note &&
          !section.note.includes("This section is directed toward AP/CP residents") && (
            <div className="mb-3 p-2 bg-yellow-50 border-l-4 border-yellow-200 text-sm text-yellow-800">
              <strong>Note:</strong> {section.note}
            </div>
          )}

        {/* Direct items */}
        {section.items && section.items.length > 0 && (
          <div className="mb-4">
            {section.items.map((item) => (
              <ABPathItemView
                key={`${item.number || ""}-${item.letter || ""}-${item.roman || ""}-${item.title}`}
                item={item}
                level={0}
                parentKey={`section-${section.type}-${section.section}`}
              />
            ))}
          </div>
        )}

        {/* Subsections */}
        {section.subsections &&
          section.subsections.map((subsection, subsectionIndex) => {
            const subsectionKey = `subsection-${section.type}-${section.section}-${subsectionIndex}`;
            const isExpanded = expandedSections.has(subsectionKey);

            return (
              <div key={subsectionKey} className="mb-4 last:mb-0">
                <button
                  onClick={() => onToggleSection(subsectionKey)}
                  className="flex items-center gap-2 w-full text-left p-2 hover:bg-gray-50 rounded border-b"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 text-gray-500" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 transition-transform duration-200 text-gray-500" />
                  )}
                  <span className="font-medium text-gray-700">
                    {subsection.number && `${subsection.number}. `}
                    {subsection.letter && `${subsection.letter}. `}
                    {subsection.title}
                  </span>
                </button>

                {isExpanded && (
                  <div className="mt-2 ml-6">
                    {/* Subsection direct items */}
                    {subsection.items && subsection.items.length > 0 && (
                      <div className="mb-3">
                        {subsection.items.map((item) => (
                          <ABPathItemView
                            key={`${item.number || ""}-${item.letter || ""}-${item.roman || ""}-${item.title}`}
                            item={item}
                            level={0}
                            parentKey={subsectionKey}
                          />
                        ))}
                      </div>
                    )}

                    {/* Subsection sections */}
                    {subsection.sections &&
                      subsection.sections.map(
                        (subSection: ABPathSubSection, subSectionIndex: number) => (
                          <div
                            key={`${subsectionKey}-section-${subSectionIndex}`}
                            className="mb-3 last:mb-0"
                          >
                            <div className="font-medium text-sm text-gray-600 mb-1 pl-2 border-l-2 border-gray-200">
                              {subSection.title}
                            </div>
                            {subSection.items && subSection.items.length > 0 && (
                              <div className="ml-4">
                                {subSection.items.map((item) => (
                                  <ABPathItemView
                                    key={`${item.number || ""}-${item.letter || ""}-${item.roman || ""}-${item.title}`}
                                    item={item}
                                    level={0}
                                    parentKey={`${subsectionKey}-section-${subSectionIndex}`}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      )}
                  </div>
                )}
              </div>
            );
          })}
      </CardContent>
    </Card>
  );
}
