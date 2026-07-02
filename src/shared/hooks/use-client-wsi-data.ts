"use client";

import { useEffect } from "react";
import { VirtualSlide } from "@/shared/types/virtual-slides";
import { loadR2Json, useR2Json } from "@/shared/hooks/use-r2-json";
import { toast } from "@/shared/utils/ui/toast";
import { log } from "@/shared/utils/logging";

// Type for PathPresenter case data from JSON
interface PathPresenterCase {
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
}

// WSI data URL - using the optimized PathPresenter cases
const WSI_DATA_URL =
  "https://pub-cee35549242c4118a1e03da0d07182d3.r2.dev/virtual-slides/public_wsi_cases.json";

// Convert the PathPresenter cases JSON into VirtualSlide entries, dropping any
// without a usable remote URL.
function transformWSIData(raw: unknown): VirtualSlide[] {
  const json = raw as { cases?: PathPresenterCase[] };
  const pathPresenterCases = (json.cases || []) as PathPresenterCase[];

  const entries: VirtualSlide[] = pathPresenterCases.map((pathCase, index) => {
    // Generate consistent ID
    const caseId = `pathpresenter_${index + 1}`;

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
      repository: "PathPresenter",
      category: pathCase.chapter || "Unknown",
      subcategory: pathCase.organ_system || "Unknown",
      diagnosis: pathCase.diagnosis || "Unknown diagnosis",
      patient_info: `${pathCase.organ_system || "Unknown organ"} case from PathPresenter`,
      age: ageMatch ? ageMatch[1] : null,
      gender: genderMatch ? genderMatch[1].toLowerCase() : null,
      clinical_history: clinicalHistory,
      stain_type: "H&E", // Assume H&E for PathPresenter cases
      image_url: pathCase.url,
      slide_url: pathCase.url,
      case_url: pathCase.url,
      thumbnail_url: "",
      preview_image_url: "",
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
    return wsiData.filter((slide) => slide.category.toLowerCase().includes(category.toLowerCase()));
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
