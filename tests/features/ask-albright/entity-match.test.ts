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
    expect(text).toContain("Negative: Chromogranin; Trypsin (loss).");
    expect(text).toContain("Molecular: CTNNB1 exon 3 mutation.");
    expect(text).not.toContain("KRAS");
    expect(text).not.toContain("Ki-67");
    // Read as a verdict, the lists misled (calretinin "reliable in both").
    expect(text).toMatch(/not how often or how strongly/);
  });

  it("returns null when the knowledge base has nothing usable", () => {
    expect(entityProfileText("X", [row("Ki-67", "protein", "index")])).toBeNull();
  });
});
