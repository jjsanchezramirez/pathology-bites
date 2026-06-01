// src/shared/utils/repository.ts

// Derive repository name from slide ID prefix (client-side)
export function getRepositoryFromId(id: string): string {
  if (!id) return "Unknown";
  if (id.startsWith("hemepath_")) return "Hematopathology eTutorial";
  if (id.startsWith("leeds_")) return "Leeds University";
  if (id.startsWith("pathpresenter_")) return "PathPresenter";
  if (id.startsWith("mgh_")) return "MGH Pathology";
  // Toronto is dropped from the corpus at build time, but keep this mapping: the live corpus
  // still carries toronto_ records until the next publish, and the client-side hide-filter
  // keys on this exact name (without it they leak in as "Unknown"). Harmless once republished.
  if (id.startsWith("toronto_")) return "University of Toronto LMP";
  if (id.startsWith("rosai_")) return "Rosai Collection";
  if (id.startsWith("recutclub_")) return "Recut Club";
  if (id.startsWith("who_")) return "WHO Blue Books Online";
  if (id.startsWith("pittnp_")) return "AANP Diagnostic Slide Session";
  if (id.startsWith("wirtualny_")) return "Wirtualny Mikroskop";
  if (id.startsWith("learnhaem_")) return "LearnHaem";
  if (id.startsWith("SJ")) return "St. Jude Cloud";
  return "Unknown";
}

// Repositories our in-house OSD viewer can render (tilesource resolver handles DZI / Leeds
// / Aperio). Others (PathPresenter SAS-token, Recut login, Wirtualny IIIF-not-wired) keep
// the external link-out.
const VIEWER_SUPPORTED_REPOS = new Set([
  "Hematopathology eTutorial",
  "Leeds University",
  "MGH Pathology",
  "Rosai Collection",
  "WHO Blue Books Online",
  "AANP Diagnostic Slide Session",
  "St. Jude Cloud",
  "Wirtualny Mikroskop",
  "LearnHaem",
]);

export function isViewerSupported(repository: string): boolean {
  return VIEWER_SUPPORTED_REPOS.has(repository);
}
