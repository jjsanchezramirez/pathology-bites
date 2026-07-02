"use client";

import { useEffect } from "react";
import { CELL_QUIZ_IMAGES_URL, CELL_QUIZ_REFERENCES_URL } from "@/shared/config/cell-quiz";
import { useR2Json } from "@/shared/hooks/use-r2-json";
import { transformCellQuizData } from "@/shared/utils/r2/r2-url-transformer";
import { toast } from "@/shared/utils/ui/toast";

// Type definitions for cell quiz data
export interface CellImageData {
  name: string;
  description: string;
  key_features: string[];
  images: string[];
  look_alikes?: string[];
}

export interface BloodCellReference {
  name: string;
  key_features: string;
  description: string;
  size?: string;
  nc_ratio?: string;
  nucleus?: string;
  lineage?: string;
  normal_percentage?: string;
  clinical_significance?: string;
  notes?: string;
}

export interface BloodCellsReferenceData {
  cells: BloodCellReference[];
}

export interface CellQuizImagesData {
  [cellKey: string]: CellImageData;
}

interface UseCellQuizResult {
  cellData: CellQuizImagesData | null;
  bloodCellsReference: BloodCellsReferenceData | null;
  isLoading: boolean;
  error: string | null;
}

// Transform URLs to use R2 public URLs on client-side
function transformImages(raw: unknown): CellQuizImagesData {
  return transformCellQuizData(raw) as CellQuizImagesData;
}

export function useClientCellQuiz(): UseCellQuizResult {
  const {
    data: cellData,
    isLoading: imagesLoading,
    error: imagesError,
  } = useR2Json<CellQuizImagesData>({
    url: CELL_QUIZ_IMAGES_URL,
    fallbackUrl: "/api/public/tools/cell-quiz/images",
    transform: transformImages,
    label: "cell quiz images",
  });

  const {
    data: bloodCellsReference,
    isLoading: referencesLoading,
    error: referencesError,
  } = useR2Json<BloodCellsReferenceData>({
    url: CELL_QUIZ_REFERENCES_URL,
    fallbackUrl: "/api/public/tools/cell-quiz/references",
    label: "cell quiz references",
  });

  const isLoading = imagesLoading || referencesLoading;
  const error = imagesError || referencesError;

  // Surface load failures as toasts (network blips, laptop sleep/wake, etc.)
  useEffect(() => {
    if (!error) return;
    if (/network|Failed to fetch/i.test(error)) {
      toast.error("Network connection interrupted. Please refresh the page.");
    } else if (error.includes("Timed out")) {
      toast.error("Request timed out. Please check your network connection.");
    } else {
      toast.error(error);
    }
  }, [error]);

  return {
    cellData,
    bloodCellsReference,
    isLoading,
    error,
  };
}
