"use client";

import { useEffect } from "react";
import { VirtualSlide } from "@/shared/types/virtual-slides";
import { loadR2Json, useR2Json } from "@/shared/hooks/use-r2-json";
import { toast } from "@/shared/utils/ui/toast";
import { log } from "@/shared/utils/logging";
import { slideMatchesCategory } from "@/features/user/wsi-questions/components/wsi-question-generator-utils";

/**
 * A case in the question corpus.
 *
 * Two sources share this file. PathPresenter cases carry the author's own
 * immuno/molecular notes and reach the viewer through a pre-resolved DZI. WHO
 * haematolymphoid cases come from the curation tool instead — a slide from the
 * virtual-slides corpus paired with the WHO entity as its answer — and carry a
 * `repository` the tile-source resolver knows how to open by host. Fields the
 * second kind uses are optional, so a PathPresenter case is unchanged.
 */
interface WsiQuestionCase {
  authors?: string[] | string;
  clinical_history?: string;
  chapter?: string;
  organ_system?: string;
  diagnosis?: string;
  url?: string;
  pages?: string;
  microscopic_features?: string;
  other_prognostic_factors?: string;
  immuno_profile?: string;
  molecular_profile?: string;
  differential_diagnosis?: string;
  /** Deep Zoom manifest on PathPresenter's Azure Blob containers. Resolved ahead of
   *  time and published with the corpus: `url` is a Vue case page, not a slide, so
   *  the in-house viewer has nothing to work from without this. 808/875 have one —
   *  the rest never had a pyramid built. */
  tile_source_url?: string;

  // --- WHO haematolymphoid cases (curation-derived) ---
  /** Corpus id (e.g. "leeds_1234"), used verbatim so history de-duplication works. */
  slide_id?: string;
  /** Drives the tile-source resolver; PathPresenter is assumed when absent. */
  repository?: string;
  stain?: string;
  preview_image_url?: string;
  /** What the slide physically is ("peripheral blood smear"), so the question
   *  writer cannot invent a procedure that contradicts it. */
  specimen?: string;
  /** "who-entity" when the profiles describe the entity rather than this case. */
  profile_source?: string;
}

// WSI data URL - using the optimized PathPresenter cases.
// The `v` param is a cache-buster, not a real version: the object carries no
// Cache-Control and the loader fetches with `cache: "force-cache"`, so a browser
// holding the pre-tile-source copy would keep serving slides the viewer cannot
// render. Bump it whenever a republish adds a field the code depends on.
const WSI_DATA_URL =
  "https://pub-cee35549242c4118a1e03da0d07182d3.r2.dev/virtual-slides/public_wsi_cases.json?v=haem-5";

// Convert the PathPresenter cases JSON into VirtualSlide entries, dropping any
// without a usable remote URL.
function transformWSIData(raw: unknown): VirtualSlide[] {
  const json = raw as { cases?: WsiQuestionCase[] };
  const pathPresenterCases = (json.cases || []) as WsiQuestionCase[];

  const entries: VirtualSlide[] = pathPresenterCases.map((pathCase, index) => {
    // Curated cases bring their own corpus id; PathPresenter cases are numbered.
    const caseId = pathCase.slide_id || `pathpresenter_${index + 1}`;

    // Parse authors - handle both string and array formats
    let authorsArray: string[] = [];
    if (pathCase.authors) {
      if (Array.isArray(pathCase.authors)) {
        authorsArray = pathCase.authors;
      } else if (typeof pathCase.authors === "string") {
        authorsArray = [pathCase.authors];
      }
    }

    // Extract age and gender from clinical history if available
    const clinicalHistory = pathCase.clinical_history || "";
    const ageMatch = clinicalHistory.match(/(\d+)[-\s]?year[-\s]?old/i);
    const genderMatch = clinicalHistory.match(/\b(male|female|man|woman)\b/i);

    return {
      id: caseId,
      repository: pathCase.repository || "PathPresenter",
      category: pathCase.chapter || "Unknown",
      subcategory: pathCase.organ_system || "Unknown",
      diagnosis: pathCase.diagnosis || "Unknown diagnosis",
      patient_info: `${pathCase.organ_system || "Unknown organ"} case from PathPresenter`,
      age: ageMatch ? ageMatch[1] : null,
      gender: genderMatch ? genderMatch[1].toLowerCase() : null,
      clinical_history: clinicalHistory,
      stain_type: pathCase.stain || "H&E", // PathPresenter records none; assume H&E
      image_url: pathCase.url,
      slide_url: pathCase.url,
      case_url: pathCase.url,
      tileSourceUrl: pathCase.tile_source_url,
      thumbnail_url: "",
      preview_image_url: pathCase.preview_image_url || "",
      magnification: "Variable",
      organ_system: pathCase.organ_system,
      difficulty_level: "medium",
      keywords: [],
      other_urls: [],
      source_metadata: {
        pages: pathCase.pages,
        microscopic_features: pathCase.microscopic_features,
        other_prognostic_factors: pathCase.other_prognostic_factors,
        immuno_profile: pathCase.immuno_profile,
        molecular_profile: pathCase.molecular_profile,
        differential_diagnosis: pathCase.differential_diagnosis,
        specimen: pathCase.specimen,
        profile_source: pathCase.profile_source,
        authors: authorsArray,
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  });

  // Filter out any entries without valid URLs
  const validEntries = entries.filter(
    (slide) =>
      slide.image_url &&
      slide.image_url.startsWith("http") &&
      !slide.image_url.includes("localhost")
  );

  log.debug(
    `[WSI Data] ✅ Loaded ${validEntries.length} PathPresenter cases (from ${pathPresenterCases.length} total cases)`
  );

  if (validEntries.length === 0) {
    log.warn("[WSI Data] ⚠️ No valid PathPresenter cases found! This may cause loading issues.");
  }

  return validEntries;
}

// Imperative loader for callers that must `await` the dataset outside React
// (e.g. use-wsi-question-generator). Shares the per-URL module cache with the
// hook via loadR2Json — no extra fetch.
export function loadClientWSIData(): Promise<VirtualSlide[]> {
  return loadR2Json<VirtualSlide[]>({
    url: WSI_DATA_URL,
    transform: transformWSIData,
    label: "WSI data",
  });
}

export interface UseClientWSIDataResult {
  wsiData: VirtualSlide[] | null;
  isLoading: boolean;
  error: string | null;
  selectRandomWSI: () => VirtualSlide | null;
  getWSIByCategory: (category: string) => VirtualSlide[];
  getWSIByDiagnosis: (diagnosis: string) => VirtualSlide[];
}

export function useClientWSIData(): UseClientWSIDataResult {
  const {
    data: wsiData,
    isLoading,
    error,
  } = useR2Json<VirtualSlide[]>({
    url: WSI_DATA_URL,
    transform: transformWSIData,
    label: "WSI data",
  });

  // Surface load failures as toasts (network blips, laptop sleep/wake, etc.)
  useEffect(() => {
    if (!error) return;
    if (error.includes("Timed out")) {
      toast.error("Request timed out. Please check your network connection.");
    } else if (/network|Failed to fetch/i.test(error)) {
      toast.error("Network connection interrupted. Please refresh the page.");
    } else {
      toast.error(error);
    }
  }, [error]);

  const selectRandomWSI = (): VirtualSlide | null => {
    if (!wsiData || wsiData.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * wsiData.length);
    return wsiData[randomIndex];
  };

  const getWSIByCategory = (category: string): VirtualSlide[] => {
    if (!wsiData) return [];
    return wsiData.filter((slide) => slideMatchesCategory(slide.category, category));
  };

  const getWSIByDiagnosis = (diagnosis: string): VirtualSlide[] => {
    if (!wsiData) return [];
    return wsiData.filter((slide) =>
      slide.diagnosis.toLowerCase().includes(diagnosis.toLowerCase())
    );
  };

  return {
    wsiData,
    isLoading,
    error,
    selectRandomWSI,
    getWSIByCategory,
    getWSIByDiagnosis,
  };
}
