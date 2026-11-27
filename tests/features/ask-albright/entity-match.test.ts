import { describe, it, expect } from "vitest";
import {
  buildEntityIndex,
  entityProfileText,
  findEntities,
  matchNorm,
} from "@/features/user/ask-albright/lib/entity-match";

const E = (id: string, name: string) => ({ id, slug: id, name });
const entities = [
  E("spn-ped", "Solid pseudopapillary neoplasm"),
  E("spn-dig", "Solid pseudopapillary neoplasm of the pancreas"),
  E("gist", "Gastrointestinal stromal tumour"),
  E("aml-leuk", "Acute myeloid leukaemia"),
  E("aml-angio", "Angiomyolipoma"),
  E("chl", "Classic Hodgkin lymphoma"),
];
const synonyms = [
  { entity_id: "spn-dig", term: "Solid pseudopapillary neoplasm", kind: "alias" },
  { entity_id: "gist", term: "GIST", kind: "abbreviation" },
  { entity_id: "aml-leuk", term: "AML", kind: "abbreviation" },
  { entity_id: "aml-angio", term: "AML", kind: "abbreviation" },
  { entity_id: "chl", term: "CHL", kind: "abbreviation" },
];
const idx = buildEntityIndex(entities, synonyms);

describe("entity matching", () => {
  it("folds British spellings and punctuation", () => {
    expect(matchNorm("Gastrointestinal stromal tumour")).toBe("gastrointestinal stromal tumor");
    expect(matchNorm("Acute myeloid leukaemia (AML)")).toBe("acute myeloid leukemia aml");
  });

  it("takes the longest mention, pooling every volume's entity for one name", () => {
    const found = findEntities(
      idx,
      "Immunoprofile of solid pseudopapillary neoplasm of the pancreas?"
    );
    expect(found).toHaveLength(1);
    expect(found[0].entities.map((e) => e.id)).toEqual(["spn-dig"]);

    const short = findEntities(idx, "What stains solid-pseudopapillary neoplasm?");
    expect(short[0].entities.map((e) => e.id).sort()).toEqual(["spn-dig", "spn-ped"]);
  });

  it("matches American spellings against British names", () => {
    expect(findEntities(idx, "gastrointestinal stromal tumor markers")[0].name).toBe(
      "Gastrointestinal stromal tumour"
    );
  });

  it("needs capitals for abbreviations and skips ambiguous ones", () => {
    expect(findEntities(idx, "Which stain for GIST?")[0].entities[0].id).toBe("gist");
    expect(findEntities(idx, "the gist of it")).toEqual([]);
    expect(findEntities(idx, "Is CD33 positive in AML?")).toEqual([]); // leukaemia or angiomyolipoma
    expect(findEntities(idx, "CHL vs GIST").map((f) => f.entities[0].id)).toEqual(["chl", "gist"]);
  });
});

describe("site-qualified names answer to their stem", () => {
  const e = (id: string, name: string) => ({ id, slug: id, name });
  const idx = buildEntityIndex(
    [
      e("lgsc-ov", "Low-grade serous carcinoma of the ovary"),
      e("lgsc-pe", "Low-grade serous carcinoma of the peritoneum"),
      e("scc", "Squamous cell carcinoma"),
      e("scc-lung", "Squamous cell carcinoma of the lung"),
      e("a1", "Adenocarcinoma of the ampulla"),
      e("ac1", "Acinar cell carcinoma of the pancreas"),
      e("ac2", "Acinar cell carcinoma of the salivary gland"),
      e("ac3", "Acinar cell carcinoma of the breast"),
      e("ac4", "Acinar cell carcinoma of the prostate"),
      e("ccsk", "Clear cell sarcoma of the kidney"),
      e("ccs-st", "Clear cell sarcoma of soft tissue"),
      e("mc", "Mixed carcinoma of the ovary"),
    ],
    []
  );
  const ids = (q: string) => findEntities(idx, q).flatMap((f) => f.entities.map((x) => x.id));

  it("finds both site variants from the bare name", () => {
    expect(ids("Is p53 wildtype in low-grade serous carcinoma?").sort()).toEqual([
      "lgsc-ov",
      "lgsc-pe",
    ]);
  });
  it("leaves a stem that an entity already owns to that entity", () => {
    expect(ids("p40 in squamous cell carcinoma")).toEqual(["scc"]);
  });
  it("skips short stems and stems shared by many sites", () => {
    expect(ids("adenocarcinoma markers")).toEqual([]);
    expect(ids("mixed carcinoma markers")).toEqual([]);
    expect(ids("acinar cell carcinoma markers")).toEqual([]);
  });
  it("skips a stem that another tumour's name starts with", () => {
    // Clear cell sarcoma of the kidney is not clear cell sarcoma of soft tissue.
    expect(ids("Is S100 positive in clear cell sarcoma?")).toEqual([]);
  });
});

describe("entityProfileText", () => {
  const row = (
    name: string,
    kind: string,
    call: string,
    sources = 1,
    pct: number | null = null
  ) => ({
    entity_id: "x",
    name,
    kind,
    call,
    sources,
    pooled_pct: pct,
  });

  it("groups positive, negative and molecular, best-sourced first, each marker once", () => {
    const text = entityProfileText("SPN", [
      row("CD10", "protein", "positive", 1),
      row("β-catenin", "protein", "positive", 3, 98.4),
      row("β-catenin", "protein", "negative", 1),
      row("Chromogranin", "protein", "negative"),
      row("Trypsin", "protein", "loss"),
      row("CTNNB1 exon 3", "mutation", "positive"),
      row("KRAS", "mutation", "negative"),
      row("Ki-67", "protein", "index"),
    ])!;
    expect(text).toContain("Positive: β-catenin (98%); CD10.");
    expect(text).toContain("Negative: Chromogranin.");
    expect(text).toContain("Loss of expression (stain lost in the tumour cells): Trypsin.");
    expect(text).toContain("Molecular: CTNNB1 exon 3 mutation.");
    expect(text).toContain("Molecular, reported absent: KRAS mutation.");
    expect(text).not.toContain("Ki-67");
    // Read as a verdict, the lists misled (calretinin "reliable in both").
    expect(text).toMatch(/not how often or how strongly/);
  });

  it("gives loss, retained, aberrant and wild-type lines of their own", () => {
    // "Negative: SDHB (loss)" was read as "SDHB is not lost".
    const text = entityProfileText("Paraganglioma", [
      row("Chromogranin", "protein", "positive", 2),
      row("SDHB", "protein", "loss"),
      row("INI1", "protein", "retained"),
      row("p53", "protein", "aberrant", 2),
      row("RB1", "protein", "wildtype"),
    ])!;
    expect(text).toContain("Positive: Chromogranin.");
    expect(text).toMatch(/Loss of expression[^:]*: SDHB\./);
    expect(text).toMatch(/Retained expression[^:]*: INI1\./);
    expect(text).toMatch(/Aberrant, mutation-type staining[^:]*: p53\./);
    expect(text).toMatch(/Wild-type, normal-pattern staining: RB1\./);
    expect(text).not.toMatch(/Negative:/);
    expect(text.match(/Positive: [^.]*\./)?.[0]).toBe("Positive: Chromogranin.");
  });

  it("keeps a marker that is lost in some and retained in others on both lines", () => {
    const text = entityProfileText("Paraganglioma", [
      row("SDHB", "protein", "retained", 1, 100),
      row("SDHB", "protein", "loss", 1),
    ])!;
    expect(text).toMatch(/Loss of expression[^:]*: SDHB\./);
    expect(text).toMatch(/Retained expression[^:]*: SDHB \(100%\)\./);
  });

  it("lists molecular findings reported absent on a line of their own", () => {
    const text = entityProfileText("ACP", [
      row("CTNNB1 exon 3", "mutation", "positive"),
      row("BRAF p.V600E", "mutation", "negative", 2),
    ])!;
    expect(text).toContain("Molecular: CTNNB1 exon 3 mutation.");
    expect(text).toContain("Molecular, reported absent: BRAF p.V600E mutation.");
  });

  it("profiles an entity whose only findings are pattern calls", () => {
    expect(entityProfileText("LGSC", [row("p53", "protein", "wildtype")])).toMatch(
      /Wild-type, normal-pattern staining: p53\./
    );
  });

  it("returns null when the knowledge base has nothing usable", () => {
    expect(entityProfileText("X", [row("Ki-67", "protein", "index")])).toBeNull();
  });
});
