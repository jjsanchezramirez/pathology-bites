import { describe, expect, it } from "vitest";
import { checkTables, classifyCell } from "@/features/user/ask-albright/lib/table-check";
import type { ProfileRow } from "@/features/user/ask-albright/lib/entity-match";

const row = (name: string, call: string, kind = "protein"): ProfileRow => ({
  entity_id: "x",
  name,
  call,
  kind,
  pooled_pct: null,
  sources: 1,
});

const ACP = {
  title: "Adamantinomatous craniopharyngioma",
  n: 3,
  rows: [
    row("β-catenin", "positive"),
    row("BRAF p.V600E", "negative", "mutation"),
    row("CK7", "positive"),
  ],
};
const PCP = {
  title: "Papillary craniopharyngioma",
  n: 4,
  rows: [
    row("β-catenin", "wildtype"),
    row("BRAF p.V600E", "positive", "mutation"),
    row("BRAF p.V600E", "positive"),
  ],
};

const table = (rows: string[]) =>
  [
    "| Feature | Papillary craniopharyngioma | Adamantinomatous craniopharyngioma |",
    "| --- | --- | --- |",
    ...rows,
  ].join("\n");

describe("checkTables", () => {
  it("corrects β-catenin credited from the differential, in its own vocabulary", () => {
    const { text, fixes } = checkTables(table(["| β-catenin | Negative [1] | Negative [2] |"]), [
      ACP,
      PCP,
    ]);
    expect(text).toContain(
      "| β-catenin | Membranous only, no nuclear (normal pattern) [4] | Nuclear (aberrant) [3] |"
    );
    expect(fixes).toHaveLength(2);
  });

  it("leaves cells that already agree", () => {
    const t = table(["| Beta-catenin | Membranous [1] | Nuclear and cytoplasmic [2] |"]);
    expect(checkTables(t, [ACP, PCP]).text).toBe(t);
  });

  it("corrects a molecular row", () => {
    const { text } = checkTables(table(["| BRAF V600E mutation | Present [1] | Present [2] |"]), [
      ACP,
      PCP,
    ]);
    expect(text).toContain("| BRAF V600E mutation | Present [1] | Absent [3] |");
  });

  it("shortens the profile heading copied into a cell", () => {
    const { text } = checkTables(
      table(["| BRAF V600E | 95% [1] | Molecular, reported absent [3] |"]),
      [ACP, PCP]
    );
    expect(text).toContain("| BRAF V600E | 95% [1] | Absent [3] |");
  });

  it("checks signed stains inside a list cell", () => {
    const { text } = checkTables(
      table(["| Key stains | CK7+, β-catenin+ [1] | CK7+, CK17+, β-catenin- [2] |"]),
      [ACP, PCP]
    );
    expect(text).toContain(
      "| Key stains | CK7+, β-catenin (membranous only) [4] [1] | CK7+, CK17+, β-catenin (nuclear) [3] [2] |"
    );
  });

  it("does not repeat a citation the model already gave", () => {
    const { text } = checkTables(table(["| Key stains | CK7+ | β-catenin+ [3] |"]), [ACP, PCP]);
    expect(text).toContain("| β-catenin (nuclear) [3] |");
  });

  it("flips a contradicted plain marker in a list and leaves agreeing ones", () => {
    const { text } = checkTables(table(["| Key stains | CD20- | CK7-, CK20- [2] |"]), [ACP, PCP]);
    expect(text).toContain("| CK7+ [3], CK20- [2] |");
  });

  it("does not spell out plain markers that agree", () => {
    const t = table(["| CK7 | Positive | Positive [2] |"]);
    expect(checkTables(t, [ACP, PCP]).text).toBe(t);
  });

  it("skips markers the knowledge base lacks and unmatched columns", () => {
    const t = [
      "| Feature | Tumour A | Tumour B |",
      "| --- | --- | --- |",
      "| β-catenin | Negative | Negative |",
    ].join("\n");
    expect(checkTables(t, [ACP, PCP]).text).toBe(t);
    const u = table(["| SOX2 | Negative | Negative |"]);
    expect(checkTables(u, [ACP, PCP]).text).toBe(u);
  });

  it("does not rewrite when the knowledge base disagrees with itself", () => {
    const mixed = { ...ACP, rows: [row("β-catenin", "positive"), row("β-catenin", "wildtype")] };
    const t = table(["| β-catenin | Negative | Negative |"]);
    expect(checkTables(t, [mixed, PCP]).text).toContain("| Negative |");
  });
});

describe("classifyCell", () => {
  it.each([
    ["Positive (not diffuse)", "positive"],
    ["Negative (positive in stroma)", "negative"],
    ["No nuclear staining; membranous", "wildtype"],
    ["Nuclear accumulation", "nuclear"],
    ["Lost", "loss"],
    ["Loss of membranous staining", "loss"],
    ["Not reported", null],
    ["Variable", null],
  ])("%s → %s", (cell, cls) => expect(classifyCell(cell)).toBe(cls));
});
