// Data model for the IHC panel tool. The public site consumes a compiled,
// denormalized snapshot (this shape) served as a static asset. A `cell` is the
// result for one (diagnosis, marker) pair. Most cells are qualitative
// (polarity, no %); some carry a reported positivity %. Every cell links to the
// primary reference(s) it was derived from.

export interface Marker {
  id: string;
  name: string;
  aliases?: string[];
  category?: string;
}

export interface Diagnosis {
  id: string;
  name: string;
  organ: string;
  /** every organ chapter the entity was found under (cross-organ merge) */
  organs?: string[];
  /** WHO "Related terminology" synonyms (old/alternate names) for search */
  aliases?: string[];
  /**
   * What sort of thing this is, from WHO's own book structure -- bookid 67 is
   * the Genetic Tumour Syndromes volume, and each other book has a genetic
   * tumour syndromes chapter. Never inferred from the name: "Sezary syndrome",
   * "Erdheim-Chester disease" and "Rosai-Dorfman disease" are neoplasms.
   *
   * It matters here because a SYNDROME does not have an immunoprofile the way a
   * tumour does. What it has is a surrogate -- SDHB loss standing in for a
   * germline SDHx mutation, MMR-protein loss for Lynch -- performed on the
   * tumour but reporting the germline defect. Markers that merely belong to a
   * tumour the syndrome predisposes to are re-homed onto that tumour instead of
   * being listed here, because "MEN2 is positive for calcitonin" is false; the
   * medullary carcinoma is.
   */
  kind?: "neoplasm" | "syndrome" | "non_neoplastic";
}

export interface Reference {
  id: string;
  citation: string;
  pmid?: string;
  doi?: string;
  type?: string;
}

export interface Cell {
  /** diagnosis id */
  d: string;
  /** marker id */
  m: string;
  /**
   * "index" is a proliferation index reported as a number, not a positive: WHO
   * writing "Ki-67 index < 5%" was recorded as Ki-67 POSITIVE in the first
   * extraction, which reads as the opposite of what the source says.
   */
  polarity: "positive" | "negative" | "index";
  /**
   * How firmly the source states it. A re-audit of every call found 19.7% of
   * them hedged in the text — "a subset", "variable", "weak" — while the table
   * presented all of them as definite.
   */
  certainty?: "definite" | "variable";
  /**
   * Provenance, from reconciling two independent extractions against a
   * sentence-level audit:
   *   confirmed  both passes agree
   *   carried    one pass only, but the audit verified its quote supports it
   *   review     the passes disagree — shown as unsettled, never asserted
   */
  status?: "confirmed" | "carried" | "review";
  /** reported positivity % (0–100), or null when only qualitative */
  pct: number | null;
  /** total cases pooled, when known (from primary literature) */
  n?: number;
  /** staining pattern, e.g. "paranuclear dot-like" */
  pattern?: string | null;
  /** the WHO source sentence this cell was derived from (evidence transparency) */
  quote?: string | null;
  /** supporting reference ids (keys into Matrix.references) */
  refs: string[];
}

export interface Matrix {
  version: number;
  generatedAt: string;
  source?: string;
  markers: Marker[];
  diagnoses: Diagnosis[];
  references: Record<string, Reference>;
  cells: Cell[];
}

// Companion dataset: molecular alterations + therapeutic/predictive markers,
// keyed by the same diagnosis id slug as the Matrix.
export interface MolecularAlteration {
  alteration: string;
  kind:
    | "fusion"
    // A break with no partner named: break-apart FISH, antigen-receptor clonality.
    | "rearrangement"
    | "mutation"
    | "amplification"
    | "deletion"
    | "methylation"
    // Whole-chromosome and arm-level copy change. The v2 extraction records it
    // as its own kind; before that it was flattened into deletion/amplification.
    | "aneuploidy"
    | "other";
  /** Only set when the chapter printed a figure for THIS alteration. */
  significance?: string | null;
  detection?: string | null;
  /**
   * The sentence the claim came from, verified verbatim against the WHO chapter
   * that makes it. v1 had no such field: its `significance` string ("common",
   * "reported") was standing in for a citation it never had.
   */
  quote?: string | null;
  /** `absent` is a real claim — the chapter says this tumour LACKS it. */
  presence?: "present" | "absent";
  certainty?: "definite" | "variable";
  refs: string[];
}

export interface TherapeuticMarker {
  marker: string;
  implication?: string | null;
  /** Verbatim WHO sentence tying this marker to treatment. */
  quote?: string | null;
  refs: string[];
}

export interface MolecularEntry {
  name: string;
  organ: string;
  molecular: MolecularAlteration[];
  therapeutic: TherapeuticMarker[];
}

export interface MolecularData {
  version: number;
  generatedAt: string;
  source?: string;
  references: Record<string, Reference>;
  byDiagnosis: Record<string, MolecularEntry>;
}
