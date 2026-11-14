import type { BloodCellReference } from "@/shared/hooks/use-client-cell-quiz";

// The "what makes this cell this cell" panel shown after an answer.
export function CellReferenceNote({
  info,
  fallback,
}: {
  info: BloodCellReference | null;
  fallback: string;
}) {
  if (!info) return <p className="text-sm text-muted-foreground">{fallback}</p>;

  const rows: [string, string | undefined][] = [
    ["Size", info.size],
    ["N:C", info.nc_ratio],
    ["Nucleus", info.nucleus],
    ["Features", info.key_features],
  ];
  return (
    <dl className="space-y-1 text-sm">
      {rows
        .filter(([, v]) => !!v)
        .map(([label, value]) => (
          <div key={label} className="flex gap-2">
            <dt className="w-16 shrink-0 font-medium text-foreground">{label}</dt>
            <dd className="text-muted-foreground">{value}</dd>
          </div>
        ))}
    </dl>
  );
}
