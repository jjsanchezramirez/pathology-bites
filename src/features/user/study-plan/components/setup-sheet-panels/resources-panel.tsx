"use client";

import { Button } from "@/shared/components/ui/button";
import { Plus } from "lucide-react";
import type { StudyResource } from "../../lib/types";
import { PanelHeader, ResourceItem } from "../setup-sheet-parts";

export function ResourcesPanel({
  resources,
  onEditResource,
  onAddResource,
  onBack,
}: {
  resources: StudyResource[];
  onEditResource: (resource: StudyResource) => void;
  onAddResource: () => void;
  onBack: () => void;
}) {
  const typeOrder: Record<string, number> = { book: 0, qbank: 1, video: 2, flashcards: 3 };
  const sorted = [...resources].sort(
    (a, b) => (typeOrder[a.type] ?? 9) - (typeOrder[b.type] ?? 9) || a.name.localeCompare(b.name)
  );
  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="Resources" onBack={onBack} />
      <div className="flex-1 overflow-y-auto">
        {sorted.map((resource) => (
          <ResourceItem
            key={resource.id}
            resource={resource}
            onEdit={() => onEditResource(resource)}
          />
        ))}
        <div className="p-4">
          <Button variant="outline" size="sm" className="w-full" onClick={onAddResource}>
            <Plus size={14} /> Add Resource
          </Button>
        </div>
      </div>
    </div>
  );
}
