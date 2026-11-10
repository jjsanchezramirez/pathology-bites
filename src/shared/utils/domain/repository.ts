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
// / Aperio / Wirtualny). Others — Recut (login), University of Toronto (auth-walled) and
// WHO Blue Books Online (subscription-walled since Nov 2026, see whoSourceViewerUrl) —
// keep the external link-out. PathPresenter renders too, but only via a pre-resolved
// tile_source_url published with the case, so it is gated on that field rather than listed here.
const VIEWER_SUPPORTED_REPOS = new Set([
  "Hematopathology eTutorial",
  "Leeds University",
  "MGH Pathology",
  "Rosai Collection",
  "AANP Diagnostic Slide Session",
  "St. Jude Cloud",
  "Wirtualny Mikroskop",
  "LearnHaem",
]);

export function isViewerSupported(repository: string): boolean {
  return VIEWER_SUPPORTED_REPOS.has(repository);
}

// WHO rebuilt Classification of Tumours Online (Nov 2026). The open DZIs at
// /static/dzi/<fid>.dzi are gone — every path there now returns the app shell with a 200,
// which is why a status-only check misses it — and Viewer/Index2?fid= returns 400. Slides
// now live at /api/Images/<fid>.dzi?token=<subscriber session JWT> (403 without it), so
// they cannot render in our viewer. The file ids survived the move, and the new viewer
// page is /displayviewerhd/<bookId>/<chapterId>/<fid>; book and chapter come from the
// corpus id who_<bookId>_<chapterId>_<n> (present on every WHO entry, unlike `k`).
// Returns the input unchanged when either part is missing, so a bad record degrades to
// the old link rather than to nothing.
const WHO_ORIGIN = "https://tumourclassification.iarc.who.int";
export function whoSourceViewerUrl(id: string, caseUrl: string): string {
  const ids = /^who_(\d+)_(\d+)_\d+$/.exec(id);
  const fid = /[?&]fid=(\d+)/.exec(caseUrl);
  if (!ids || !fid) return caseUrl;
  return `${WHO_ORIGIN}/displayviewerhd/${ids[1]}/${ids[2]}/${fid[1]}`;
}
