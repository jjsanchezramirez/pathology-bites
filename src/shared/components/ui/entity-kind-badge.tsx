import { Badge } from "@/shared/components/ui/badge";
import { cn } from "@/shared/utils";

/**
 * What a WHO entity IS — as distinct from the role it plays in any one volume.
 *
 * `entities.kind` and `entity_placements.rank` are allowed to disagree, and
 * usually should: gastrointestinal stromal tumour is a real tumour that also
 * heads a group in the Paediatric volume. This badge shows the former.
 */
export type EntityKind = "neoplasm" | "category" | "syndrome" | "non_neoplastic";

const STYLE: Record<EntityKind, { label: string; className: string }> = {
  neoplasm: { label: "Neoplasm", className: "border-slate-300 bg-slate-50 text-slate-700" },
  syndrome: { label: "Syndrome", className: "border-violet-300 bg-violet-50 text-violet-700" },
  non_neoplastic: {
    label: "Non-neoplastic",
    className: "border-emerald-300 bg-emerald-50 text-emerald-700",
  },
  category: { label: "Grouping", className: "border-amber-300 bg-amber-50 text-amber-700" },
};

export function EntityKindBadge({
  kind,
  className,
}: {
  kind: string | null | undefined;
  className?: string;
}) {
  const s = STYLE[(kind ?? "neoplasm") as EntityKind] ?? STYLE.neoplasm;
  return (
    <Badge variant="outline" className={cn(s.className, className)}>
      {s.label}
    </Badge>
  );
}
