import { Badge } from "@/shared/components/ui/badge";
import { cn } from "@/shared/utils";

/**
 * One pooled evidence call, in a grid cell or a chip.
 *
 * Wraps `CallBadge`, which returns **null** for a call it does not recognise —
 * fine in prose, wrong in a grid, where a null renders identically to an empty
 * cell and an unknown call becomes indistinguishable from NO EVIDENCE. Three
 * states have to stay visually distinct here:
 *
 *   no evidence        a muted ·          nothing was ever recorded
 *   unrecognised call  the raw string     something was recorded and we cannot read it
 *   dissent            both + a ⚠         sources disagree, which is a finding, not noise
 *
 * `loss` / `retained` / `wildtype` are NOT folded into negative / positive.
 * A p53 WILDTYPE pattern is weak scattered nuclear staining while strong diffuse
 * staining is the ABERRANT one, so colouring wildtype as "positive" would print
 * the opposite of what the source said.
 */
const STYLE: Record<string, { label: string; short: string; className: string }> = {
  positive: {
    label: "Positive",
    short: "+",
    className: "border-emerald-300 bg-emerald-50 text-emerald-700",
  },
  negative: {
    label: "Negative",
    short: "−",
    className: "border-rose-300 bg-rose-50 text-rose-700",
  },
  index: {
    label: "Index",
    short: "%",
    className: "border-violet-300 bg-violet-50 text-violet-700",
  },
  loss: { label: "Loss", short: "L", className: "border-rose-300 bg-rose-50 text-rose-700" },
  retained: {
    label: "Retained",
    short: "R",
    className: "border-teal-300 bg-teal-50 text-teal-700",
  },
  wildtype: { label: "Wildtype", short: "wt", className: "border-sky-300 bg-sky-50 text-sky-700" },
  mixed: { label: "Mixed", short: "±", className: "border-amber-300 bg-amber-50 text-amber-700" },
};

export function callStyle(call: string | null | undefined) {
  return STYLE[String(call ?? "").toLowerCase()] ?? null;
}

export function EvidenceCell({
  call,
  sources,
  pct,
  dissent,
  compact,
  className,
}: {
  call: string | null | undefined;
  sources?: number;
  pct?: number | null;
  dissent?: boolean;
  /** grid cells: a single glyph rather than a word */
  compact?: boolean;
  className?: string;
}) {
  if (call == null || call === "") {
    return (
      <span
        className={cn("text-muted-foreground/70 tabular-nums", className)}
        title="no evidence recorded"
        aria-label="no evidence"
      >
        ·
      </span>
    );
  }

  const s = callStyle(call);
  const title = [
    s?.label ?? `unrecognised call "${call}"`,
    sources ? `${sources} source${sources === 1 ? "" : "s"}` : null,
    pct != null ? `${pct}% pooled` : null,
    dissent ? "sources disagree" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  if (!s) {
    // Recorded, and we do not know what it means. Say so rather than vanish.
    return (
      <Badge
        variant="outline"
        className={cn("border-slate-300 bg-slate-50 text-slate-700", className)}
        title={title}
      >
        {call}
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className={cn(s.className, compact && "px-1.5 py-0 text-[10px]", className)}
      title={title}
    >
      {compact ? s.short : s.label}
      {dissent && <span aria-label="sources disagree"> ⚠</span>}
      {!compact && pct != null && <span className="ml-1 tabular-nums opacity-70">{pct}%</span>}
    </Badge>
  );
}
