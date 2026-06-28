"use client";

import { Badge } from "@/shared/components/ui/badge";
import type { ABPathItem } from "@/shared/types/abpath";

interface ABPathItemViewProps {
  item: ABPathItem;
  level?: number;
  parentKey?: string;
}

export function ABPathItemView({ item, level = 0, parentKey = "" }: ABPathItemViewProps) {
  const indent = level * 16;
  const itemKey = `${parentKey}-${item.number || ""}-${item.letter || ""}-${item.roman || ""}-${item.title}-${level}`;

  return (
    <div className="mb-1">
      <div
        className="flex items-start gap-2 py-1 px-2 rounded hover:bg-gray-50 text-sm"
        style={{ marginLeft: `${indent}px` }}
      >
        <div className="flex-shrink-0 text-gray-500 min-w-[32px] text-xs">
          {item.number && `${item.number}.`}
          {item.letter && `${item.letter}.`}
          {item.roman && `${item.roman}.`}
        </div>
        <div className="flex-1">
          <span className="text-gray-900">{item.title}</span>
          {item.designation && (
            <Badge
              variant={
                item.designation === "C"
                  ? "default"
                  : item.designation === "AR"
                    ? "secondary"
                    : "outline"
              }
              className="ml-2 text-xs"
            >
              {item.designation}
            </Badge>
          )}
          {item.note && <div className="text-xs text-gray-500 mt-1 italic">{item.note}</div>}
        </div>
      </div>
      {item.subitems &&
        item.subitems.map((subitem) => (
          <ABPathItemView
            key={`${itemKey}-${subitem.number || ""}-${subitem.letter || ""}-${subitem.roman || ""}-${subitem.title}`}
            item={subitem}
            level={level + 1}
            parentKey={itemKey}
          />
        ))}
    </div>
  );
}
