import { describe, it, expect } from "vitest";
import {
  extractSymbolTables,
  markerLike,
  relevantTables,
  splitHeader,
  tableToPromptLines,
} from "@/features/user/ask-albright/lib/tables";
import { questionTerms } from "@/features/user/ask-albright/lib/router";

// Verbatim shape of the PathologyOutlines chromophobe page as PathTalk returns it.
const CHROMO =
  "Negative stains Vimentin (or weak), CAIX (Mod Pathol 1999;12:310) IHC panels Hale KIT CK7 S100A1 VIM CAIX AMACR SDH TFE3 " +
  "Chromophobe RCC +++ +++ +++ - - - - +++ - Clear cell RCC - - - - +++ +++ - +++ - " +
  "Oncocytoma - +++ rare +++ - - - +++ - Papillary RCC - - +++ - +++ - +++ +++ - " +
  "Translocation RCC - - - - - - ++ +++ +++ SDH deficient RCC - - - - - - - - - " +
  "References: Pathol Res Pract 2015;211:303 Electron microscopy description All contain microvesicles";

describe("markerLike", () => {
  it.each(["CK7", "S100A1", "TFE3", "KIT", "CAIX", "D2-40", "p63", "Hale", "Vimentin"])(
    "accepts %s",
    (t) => expect(markerLike(t)).toBe(true)
  );
  it.each(["Chromophobe", "panels", "Oncocytoma", "cell"])("rejects %s", (t) =>
    expect(markerLike(t)).toBe(false)
  );
});

describe("splitHeader", () => {
  it("does not swallow the first row's leading word into the headers", () => {
    const before = "IHC panels Hale KIT CK7 TFE3 Chromophobe RCC".split(" ");
    expect(splitHeader(before, 4)).toEqual({
      headers: ["Hale", "KIT", "CK7", "TFE3"],
      firstRow: "Chromophobe RCC",
    });
  });
  it("gives up when the headers are not markers", () => {
    expect(splitHeader("the tumor cells are often seen Oncocytoma".split(" "), 4)).toBeNull();
  });
});

describe("extractSymbolTables", () => {
  const { tables, prose } = extractSymbolTables(CHROMO);

  it("rebuilds the panel exactly", () => {
    expect(tables).toHaveLength(1);
    const [t] = tables;
    expect(t.headers).toEqual([
      "Hale",
      "KIT",
      "CK7",
      "S100A1",
      "VIM",
      "CAIX",
      "AMACR",
      "SDH",
      "TFE3",
    ]);
    expect(t.rows.map((r) => r.name)).toEqual([
      "Chromophobe RCC",
      "Clear cell RCC",
      "Oncocytoma",
      "Papillary RCC",
      "Translocation RCC",
      "SDH deficient RCC",
    ]);
    expect(t.rows[2].cells).toEqual(["-", "+++", "rare", "+++", "-", "-", "-", "+++", "-"]);
  });

  it("removes the table from the prose and keeps the text around it", () => {
    expect(prose).toContain("IHC panels References:");
    expect(prose).not.toContain("+++");
    expect(prose).toContain("Negative stains Vimentin");
  });

  it("leaves prose with stray +/- alone", () => {
    const text = "Usually CK7 + and CK20 - in this tumor; rarely +++ focal staining is seen.";
    expect(extractSymbolTables(text)).toEqual({ tables: [], prose: text });
  });

  it("needs at least two rows of equal width", () => {
    expect(extractSymbolTables("Panel CK7 CK20 TTF1 Lung +++ - +++ then prose").tables).toEqual([]);
  });
});

describe("relevantTables + tableToPromptLines", () => {
  const { tables } = extractSymbolTables(CHROMO);

  it("focuses the rows the question names, ignoring a term that names most rows", () => {
    const terms = questionTerms("Which stains distinguish chromophobe RCC from oncocytoma?");
    const [t] = relevantTables(tables, terms);
    expect(t.focusRows).toEqual(["Chromophobe RCC", "Oncocytoma"]);
    expect(tableToPromptLines(t, t.focusRows)).toBe(
      "Chromophobe RCC: Hale +++, KIT +++, CK7 +++, S100A1 -, VIM -, CAIX -, AMACR -, SDH +++, TFE3 -; " +
        "Oncocytoma: Hale -, KIT +++, CK7 rare, S100A1 +++, VIM -, CAIX -, AMACR -, SDH +++, TFE3 -"
    );
  });

  it("keeps a table when the question names a column", () => {
    const [t] = relevantTables(tables, questionTerms("What does TFE3 mark?"));
    expect(t.focusRows).toEqual([]);
  });

  it("drops tables the question is not about", () => {
    expect(relevantTables(tables, questionTerms("Warthin tumor features"))).toEqual([]);
  });
});
