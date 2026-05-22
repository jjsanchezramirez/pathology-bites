// Behavior tests for the virtual-slide search algorithm.
//
// These run on every `npm test` — deterministic, offline, fast. They assert
// the algorithm's MECHANISMS against a small synthetic fixture; they do NOT
// measure search quality against the real corpus (that is the job of the
// regression benchmark, tests/benchmarks/search-eval.ts).
//
// Reverting either P0 fix turns a test here red:
//   - P0 #1 (organ terms nuking results)  -> organ-tumor / regression-guard tests
//   - P0 #2 (one bad word zeroing a query) -> truncation / typo / drop-word tests

import { describe, it, expect, beforeAll } from "vitest";
import {
  buildSearchIndex,
  rankSlidesWithExpansion,
} from "@/shared/utils/domain/virtual-slide-search";
import type { VirtualSlide } from "@/shared/types/virtual-slides";

// --- synthetic fixture -------------------------------------------------------
// Minimal slides — search only reads id/diagnosis/category/subcategory/acronym.
// category/subcategory use the REAL dataset values so organ boosting fires.
let seq = 0;
function mk(
  diagnosis: string,
  category: string,
  subcategory: string,
  acronym?: string
): VirtualSlide {
  return {
    id: `fx-${++seq}`,
    repository: "",
    category,
    subcategory,
    diagnosis,
    acronym,
    patient_info: "",
    age: null,
    gender: null,
    clinical_history: "",
    stain_type: "",
    preview_image_url: "",
    slide_url: "",
    case_url: "",
    other_urls: [],
    source_metadata: {},
  };
}
function repeat(n: number, factory: () => VirtualSlide): VirtualSlide[] {
  return Array.from({ length: n }, factory);
}

const GU = "Genitourinary";
const FIXTURE: VirtualSlide[] = [
  // Kidney — diagnoses say "renal", never "kidney" (the P0 #1 case)
  ...repeat(4, () => mk("Renal cell carcinoma", GU, "Kidney", "rcc")),
  ...repeat(2, () => mk("Papillary renal cell carcinoma", GU, "Kidney", "prcc")),
  mk("Chromophobe renal cell carcinoma", GU, "Kidney", "crcc"),
  mk("Clear cell sarcoma of kidney", "Pediatric", "Kidney", "ccsk"),
  // Thyroid
  ...repeat(3, () =>
    mk("Papillary thyroid carcinoma", "Endocrine and Neuroendocrine", "Thyroid", "ptc")
  ),
  mk("Follicular thyroid carcinoma", "Endocrine and Neuroendocrine", "Thyroid"),
  // Breast
  ...repeat(4, () => mk("Invasive ductal carcinoma", "Breast", "Breast", "idc")),
  mk("Invasive lobular carcinoma", "Breast", "Breast", "ilc"),
  // Liver
  ...repeat(3, () => mk("Hepatocellular carcinoma", "Hepatobiliary and Pancreas", "Liver", "hcc")),
  // Soft tissue
  ...repeat(2, () =>
    mk("Alveolar rhabdomyosarcoma", "Bone and Soft Tissue", "Soft Tissue", "arms")
  ),
  ...repeat(2, () =>
    mk("Embryonal rhabdomyosarcoma", "Bone and Soft Tissue", "Soft Tissue", "erms")
  ),
  ...repeat(2, () => mk("Clear cell sarcoma", "Bone and Soft Tissue", "Soft Tissue")),
  mk("Leiomyosarcoma", "Bone and Soft Tissue", "Soft Tissue", "lms"),
  // A (simulated) typo'd diagnosis: makes "sarcom" a real index token, so the
  // truncation "...sarcom" collides with it — guards the additive-prefix fix.
  mk("Sarcom", "Bone and Soft Tissue", "Soft Tissue"),
  // Skin
  ...repeat(2, () => mk("Basal cell carcinoma", "Dermatopathology", "Skin", "bcc")),
  ...repeat(2, () => mk("Squamous cell carcinoma", "Dermatopathology", "Skin", "scc")),
  ...repeat(2, () => mk("Melanoma", "Dermatopathology", "Skin")),
  // Brain
  ...repeat(2, () => mk("Glioblastoma", "Neuropathology", "Brain")),
  mk("Meningioma", "Neuropathology", "Brain"),
  // Hematopathology
  ...repeat(2, () => mk("Diffuse large B-cell lymphoma", "Hematopathology", "Lymph Node", "dlbcl")),
  // Noise
  ...repeat(2, () => mk("Neuroblastoma", "Pediatric", "Adrenal")),
  ...repeat(2, () => mk("Osteosarcoma", "Bone and Soft Tissue", "Bone")),
  mk("Wilms tumor", "Pediatric", "Kidney"),
];

// --- helpers -----------------------------------------------------------------
async function rank(query: string) {
  const { slides } = await rankSlidesWithExpansion(FIXTURE, query);
  return slides;
}
async function topDiagnoses(query: string, n = 20) {
  return (await rank(query)).slice(0, n).map((s) => s.diagnosis.toLowerCase());
}

// =============================================================================
describe("virtual-slide-search", () => {
  beforeAll(() => buildSearchIndex(FIXTURE));

  describe("baseline behavior", () => {
    it("an exact single-word diagnosis ranks first", async () => {
      expect((await rank("melanoma"))[0].diagnosis).toBe("Melanoma");
    });

    it("an exact multi-word diagnosis ranks first", async () => {
      expect((await rank("invasive ductal carcinoma"))[0].diagnosis).toBe(
        "Invasive ductal carcinoma"
      );
    });

    it("a WHO abbreviation resolves to its diagnosis", async () => {
      expect(await topDiagnoses("dlbcl")).toContain("diffuse large b-cell lymphoma");
    });

    it("an empty query returns the input list unranked", async () => {
      expect((await rank("")).length).toBe(FIXTURE.length);
    });
  });

  describe("P0 #2 — a single unmatched word must not zero the query", () => {
    it("a truncated multi-word query still finds the diagnosis", async () => {
      expect(await topDiagnoses("papillary thyroid carcinom")).toContain(
        "papillary thyroid carcinoma"
      );
    });

    it("a truncated query never returns zero results", async () => {
      expect((await rank("papillary thyroid carcinom")).length).toBeGreaterThan(0);
    });

    it("a typo'd word still finds the diagnosis", async () => {
      expect(await topDiagnoses("invasive ducal carcinoma")).toContain("invasive ductal carcinoma");
    });

    it("a truncation colliding with a junk token still finds the real diagnosis", async () => {
      // "sarcom" is a real token here (the "Sarcom" fixture slide). Prefix
      // expansion must be ADDITIVE — if it were gated on the exact set being
      // empty, this query would collapse onto the junk slide.
      expect(await topDiagnoses("clear cell sarcom")).toContain("clear cell sarcoma");
    });

    it("a fully unmatched word is dropped, not fatal", async () => {
      const top = await topDiagnoses("renal cell zzzznotaword");
      expect(top).toContain("renal cell carcinoma");
    });
  });

  describe("P0 #1 — organ terms must boost, not nuke", () => {
    it("an organ word + tumor finds diagnoses that use the medical alias", async () => {
      // "kidney carcinoma": the diagnosis text says "renal", not "kidney"
      expect(await topDiagnoses("kidney carcinoma", 10)).toContain("renal cell carcinoma");
    });

    it("an organ word inside an exact diagnosis still ranks first (regression guard)", async () => {
      // "renal" is a kidney alias — it must not be stripped out of an exact
      // match. This is the regression the eval harness caught.
      expect((await rank("renal cell carcinoma"))[0].diagnosis).toBe("Renal cell carcinoma");
    });

    it("an organ-only query returns that organ system", async () => {
      const slides = await rank("kidney");
      expect(slides.length).toBeGreaterThan(3);
      expect(slides.every((s) => s.subcategory === "Kidney" || s.category === GU)).toBe(true);
    });
  });
});
