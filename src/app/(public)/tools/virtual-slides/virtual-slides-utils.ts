// Pure helpers for the virtual slides page.

/**
 * Split the repository logos into balanced rows (instead of one wrapped band with a
 * lopsided trailing row): ≤6 → 1 row, ≤12 → 2, else 3, evenly chunked.
 */
export function chunkLogosIntoRows<T>(logos: T[]): T[][] {
  const total = logos.length;
  const rows = total <= 6 ? 1 : total <= 12 ? 2 : 3;
  const perRow = Math.ceil(total / rows);
  return Array.from({ length: rows }, (_, ri) => logos.slice(ri * perRow, (ri + 1) * perRow));
}
