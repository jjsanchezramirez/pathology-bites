"use client";

import { SubjectSortable } from "../subject-sortable";
import { PanelHeader } from "../setup-sheet-parts";

export function SubjectOrderPanel({
  phaseName,
  items,
  labelMap,
  onChange,
  onBack,
}: {
  phaseName: string;
  items: string[];
  labelMap: Record<string, string>;
  onChange: (next: string[]) => void;
  onBack: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <PanelHeader title={`Subject Order — ${phaseName}`} onBack={onBack} />
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <p className="text-xs text-muted-foreground">
          Drag to reorder. The scheduler fully drains subject 1 before moving to subject 2.
        </p>
        <SubjectSortable
          label={`Subjects (${items.length})`}
          items={items}
          labelMap={labelMap}
          onChange={onChange}
        />
      </div>
    </div>
  );
}
