import { Badge } from "@/shared/components/ui/badge";
import { cn } from "@/shared/utils";

/**
 * Which instrument reaches a marker.
 *
 * `markers` absorbed `alterations`, so one noun covers an antibody, a mutation
 * and a karyotype — distinguished only by `kind`. That is also why two rows can
 * share a name: TP53 the mutation and TP53 the deletion are different markers,
 * and the badge is what tells them apart on screen.
 */
export type MarkerKind =
  | "protein"
  | "mutation"
  | "fusion"
  | "rearrangement"
  | "amplification"
  | "deletion"
  | "aneuploidy"
  | "methylation"
  | "dye"
  | "probe"
  | "index";

const STYLE: Record<MarkerKind, { label: string; className: string }> = {
  protein: { label: "Protein", className: "border-sky-300 bg-sky-50 text-sky-700" },
  mutation: { label: "Mutation", className: "border-rose-300 bg-rose-50 text-rose-700" },
  fusion: { label: "Fusion", className: "border-fuchsia-300 bg-fuchsia-50 text-fuchsia-700" },
  rearrangement: {
    label: "Rearrangement",
    className: "border-purple-300 bg-purple-50 text-purple-700",
  },
  amplification: {
    label: "Amplification",
    className: "border-orange-300 bg-orange-50 text-orange-700",
  },
  deletion: { label: "Deletion", className: "border-amber-300 bg-amber-50 text-amber-700" },
  aneuploidy: { label: "Aneuploidy", className: "border-lime-300 bg-lime-50 text-lime-700" },
  methylation: { label: "Methylation", className: "border-teal-300 bg-teal-50 text-teal-700" },
  dye: { label: "Special stain", className: "border-cyan-300 bg-cyan-50 text-cyan-700" },
  probe: { label: "ISH probe", className: "border-indigo-300 bg-indigo-50 text-indigo-700" },
  index: { label: "Index", className: "border-slate-300 bg-slate-50 text-slate-700" },
};

export function MarkerKindBadge({
  kind,
  className,
}: {
  kind: string | null | undefined;
  className?: string;
}) {
  const s = STYLE[(kind ?? "protein") as MarkerKind];
  if (!s) {
    return (
      <Badge
        variant="outline"
        className={cn("border-slate-300 bg-slate-50 text-slate-700", className)}
      >
        {kind ?? "Marker"}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className={cn(s.className, className)}>
      {s.label}
    </Badge>
  );
}

/**
 * The result a study reported. Polarity carries more signal than the marker
 * class, which is why the graph colours finding edges by this and not by kind.
 */
export function CallBadge({ call, className }: { call: string | null; className?: string }) {
  const map: Record<string, { label: string; className: string }> = {
    positive: { label: "Positive", className: "border-emerald-300 bg-emerald-50 text-emerald-700" },
    negative: { label: "Negative", className: "border-rose-300 bg-rose-50 text-rose-700" },
    present: { label: "Present", className: "border-emerald-300 bg-emerald-50 text-emerald-700" },
    absent: { label: "Absent", className: "border-rose-300 bg-rose-50 text-rose-700" },
    index: { label: "Index", className: "border-violet-300 bg-violet-50 text-violet-700" },
  };
  const s = map[String(call ?? "").toLowerCase()];
  if (!s) return null;
  return (
    <Badge variant="outline" className={cn(s.className, className)}>
      {s.label}
    </Badge>
  );
}
