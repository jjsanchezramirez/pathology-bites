// Pure export builders for the cell counter: tab-delimited text, human-readable
// text, an HTML table, and an Epic-friendly RTF table. No DOM/clipboard side
// effects — those stay in the page. Unit-tested (see cell-export.test.ts).

import type { CellType } from "./cell-counter-data";
import type { MeRatio } from "./cell-counter-utils";

type ExportCell = Pick<CellType, "name" | "count">;

function pct(count: number, total: number, digits: number): string {
  return ((count / total) * 100).toFixed(digits);
}

/** Tab-delimited rows (Cell Type / Count / Percentage), plus total + optional M:E. */
export function buildPlainTextTabbed(
  cells: ExportCell[],
  totalCount: number,
  meRatio: MeRatio | null
): string {
  const rows = [
    "Cell Type\tCount\tPercentage",
    ...cells.map((cell) => `${cell.name}\t${cell.count}\t${pct(cell.count, totalCount, 2)}%`),
    `Total Count\t${totalCount}\t100%`,
  ];
  if (meRatio) {
    rows.push(`M:E Ratio\t${meRatio.ratio}:1\t(${meRatio.myeloidCount}:${meRatio.erythroidCount})`);
  }
  return rows.join("\n");
}

/** Human-readable padded text export (used by the "Copy Plain Text" button). */
export function buildPlainTextExport(
  cells: ExportCell[],
  totalCount: number,
  meRatio: MeRatio | null
): string {
  const rows = cells
    .map((cell) => {
      const percentage = pct(cell.count, totalCount, 1);
      const paddedName = cell.name.padEnd(30, " ");
      const paddedCount = cell.count.toString().padEnd(8, " ");
      return `${paddedName} ${paddedCount} ${percentage}%`;
    })
    .join("\n");

  const footer = `\n${"=".repeat(60)}\n${"Total Count:".padEnd(30, " ")} ${totalCount}`;

  let meRatioText = "";
  if (meRatio) {
    meRatioText = `\n${"M:E Ratio:".padEnd(30, " ")} ${meRatio.ratio}:1 (${meRatio.myeloidCount}:${meRatio.erythroidCount})`;
  }

  return rows + footer + meRatioText;
}

/** Plain HTML table — used for the native rich-copy (contenteditable) path. */
export function buildHtmlTable(
  cells: ExportCell[],
  totalCount: number,
  meRatio: MeRatio | null
): string {
  return `<table border="1" cellspacing="0" cellpadding="5">
<tr><th>Cell Type</th><th>Count</th><th>Percentage</th></tr>
${cells
  .map(
    (cell) =>
      `<tr><td>${cell.name}</td><td>${cell.count}</td><td>${pct(cell.count, totalCount, 2)}%</td></tr>`
  )
  .join("\n")}
<tr><td><strong>Total Count</strong></td><td><strong>${totalCount}</strong></td><td><strong>100%</strong></td></tr>
${
  meRatio
    ? `<tr><td><strong>M:E Ratio</strong></td><td><strong>${meRatio.ratio}:1</strong></td><td>(${meRatio.myeloidCount}:${meRatio.erythroidCount})</td></tr>`
    : ""
}
</table>`;
}

function escapeRtf(value: string): string {
  return (
    value
      .replace(/\\/g, "\\\\")
      .replace(/{/g, "\\{")
      .replace(/}/g, "\\}")
      // RTF uses \par for line breaks.
      .replace(/\r\n|\r|\n/g, "\\par ")
  );
}

/** Standards-friendly RTF table (Epic keys off RTF specifically). */
export function buildRtfDocument(
  cells: ExportCell[],
  totalCount: number,
  meRatio: MeRatio | null
): string {
  const rtfCellWidths = [3500, 4500, 6200];
  const rtfCellBorders =
    "\\clbrdrt\\brdrs\\brdrw10\\clbrdrl\\brdrs\\brdrw10\\clbrdrb\\brdrs\\brdrw10\\clbrdrr\\brdrs\\brdrw10";
  const rtfRowHeader =
    `\\trowd\\trgaph108\\trleft0${rtfCellBorders}\\cellx${rtfCellWidths[0]}` +
    `${rtfCellBorders}\\cellx${rtfCellWidths[1]}` +
    `${rtfCellBorders}\\cellx${rtfCellWidths[2]}`;

  const rtfRow = (rowCells: Array<{ text: string; align?: "ql" | "qr"; bold?: boolean }>) => {
    const renderedCells = rowCells
      .map(({ text, align = "ql", bold = false }) => {
        const bStart = bold ? "\\b " : "";
        const bEnd = bold ? "\\b0 " : "";
        return `\\pard\\intbl\\${align} ${bStart}${escapeRtf(text)} ${bEnd}\\cell`;
      })
      .join(" ");

    return `${rtfRowHeader} ${renderedCells} \\row`;
  };

  const rtfRows = [
    rtfRow([
      { text: "Cell Type", bold: true },
      { text: "Count", bold: true, align: "qr" },
      { text: "Percentage", bold: true, align: "qr" },
    ]),
    ...cells.map((cell) =>
      rtfRow([
        { text: cell.name },
        { text: String(cell.count), align: "qr" },
        { text: `${pct(cell.count, totalCount, 2)}%`, align: "qr" },
      ])
    ),
    rtfRow([
      { text: "Total Count", bold: true },
      { text: String(totalCount), bold: true, align: "qr" },
      { text: "100%", bold: true, align: "qr" },
    ]),
  ];

  if (meRatio) {
    rtfRows.push(
      rtfRow([
        { text: "M:E Ratio", bold: true },
        { text: `${meRatio.ratio}:1`, bold: true, align: "qr" },
        { text: `(${meRatio.myeloidCount}:${meRatio.erythroidCount})`, align: "qr" },
      ])
    );
  }

  // Use an explicit Windows codepage to improve interoperability with Windows apps.
  return (
    `{\\rtf1\\ansi\\ansicpg1252\\deff0{\\fonttbl{\\f0 Calibri;}}` +
    `\\viewkind4\\uc1\\pard\\f0\\fs22 ` +
    rtfRows.join(" ") +
    "}"
  );
}
