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
  polarity: "positive" | "negative";
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
  kind: "fusion" | "mutation" | "amplification" | "deletion" | "methylation" | "other";
  significance?: string | null;
  detection?: string | null;
  refs: string[];
}

export interface TherapeuticMarker {
  marker: string;
  implication?: string | null;
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
