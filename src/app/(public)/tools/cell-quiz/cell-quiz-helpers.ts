// Cell quiz — question generation + reference-cell lookup (pure).
import {
  BloodCellsReferenceData,
  CellQuizImagesData,
  BloodCellReference,
} from "@/shared/hooks/use-client-cell-quiz";
import {
  generateLookAlikeOptions,
  generateBiologicalOptions,
} from "@/features/public/tools/cell-quiz/data/cell-pathways";
import { log } from "@/shared/utils/logging";

export interface Question {
  cellType: string;
  imagePath: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

// Helper function to find reference cell info by cell data key
export function findReferenceCellInfo(
  cellDataKey: string,
  bloodCellsReference: BloodCellsReferenceData | null
): BloodCellReference | null {
  if (!bloodCellsReference?.cells) {
    log.warn("⚠️ No reference cells available for matching");
    return null;
  }

  const match = bloodCellsReference.cells.find((refCell: BloodCellReference) => {
    // Convert reference cell name to match cellData key format (lowercase, underscores)
    const normalizedRefName = refCell.name.toLowerCase().replace(/\s+/g, "_");
    const isMatch = normalizedRefName === cellDataKey;

    // Debug logging for troubleshooting
    if (process.env.NODE_ENV === "development") {
      log.debug(
        `🔍 Matching "${cellDataKey}" with "${refCell.name}" (normalized: "${normalizedRefName}") = ${isMatch}`
      );
    }

    return isMatch;
  });

  if (!match && process.env.NODE_ENV === "development") {
    log.warn(`⚠️ No reference match found for cell key: "${cellDataKey}"`);
    log.debug(
      "Available reference cell names:",
      bloodCellsReference.cells.map((c: BloodCellReference) => c.name)
    );
  }

  return match || null;
}

// Helper function to generate a single random question with biological relationships
export function generateRandomQuestion(
  cellData: CellQuizImagesData,
  bloodCellsReference: BloodCellsReferenceData
): Question {
  if (!cellData || !bloodCellsReference) {
    throw new Error("Cell data not loaded");
  }

  const allCells = Object.keys(cellData);
  if (allCells.length === 0) {
    throw new Error("No cell data available");
  }

  // Find cells that have both image data and reference data
  const validCells = allCells.filter((cellKey) => {
    const hasImages = cellData[cellKey]?.images?.length > 0;
    const hasReference = !!findReferenceCellInfo(cellKey, bloodCellsReference);
    return hasImages && hasReference;
  });

  if (validCells.length === 0) {
    log.error("❌ No cells found with both image and reference data");
    log.debug("Available cell keys:", allCells);
    log.debug(
      "Available reference names:",
      bloodCellsReference?.cells?.map((c: BloodCellReference) => c.name) || []
    );
    throw new Error("No valid cells found for quiz generation");
  }

  const correctCellType = validCells[Math.floor(Math.random() * validCells.length)];
  const cellInfo = cellData[correctCellType];
  const referenceInfo = findReferenceCellInfo(correctCellType, bloodCellsReference);

  // Pick a random image for this cell type
  const randomImage = cellInfo.images[Math.floor(Math.random() * cellInfo.images.length)];

  // Use reference name if available, otherwise fall back to cell data name
  const correctAnswerName = referenceInfo ? referenceInfo.name : cellInfo.name;

  // Generate challenging options using look-alikes data
  const lookAlikeOptions = generateLookAlikeOptions(correctCellType, cellData);

  // Map cell types to display names, preferring reference names when available
  const options = lookAlikeOptions
    .map((cellType) => {
      const cellInfoItem = cellData[cellType];
      if (!cellInfoItem) return null;

      const referenceInfoItem = findReferenceCellInfo(cellType, bloodCellsReference);
      return referenceInfoItem ? referenceInfoItem.name : cellInfoItem.name;
    })
    .filter(Boolean) as string[];

  // Ensure we have exactly 4 options, fallback to biological options if needed
  if (options.length < 4) {
    const biologicalOptions = generateBiologicalOptions(correctCellType);
    const fallbackOptions = biologicalOptions
      .filter((cellType) => !lookAlikeOptions.includes(cellType))
      .slice(0, 4 - options.length)
      .map((cell) => {
        const cellInfoItem = cellData[cell];
        if (!cellInfoItem) return null;
        const referenceInfoItem = findReferenceCellInfo(cell, bloodCellsReference);
        return referenceInfoItem ? referenceInfoItem.name : cellInfoItem.name;
      })
      .filter(Boolean) as string[];

    options.push(...fallbackOptions);
  }

  // Shuffle the final options
  const shuffledOptions = options.sort(() => Math.random() - 0.5);

  return {
    cellType: correctCellType,
    imagePath: randomImage,
    options: shuffledOptions,
    correctAnswer: correctAnswerName,
    explanation: referenceInfo
      ? `${referenceInfo.key_features || cellInfo.description}`
      : cellInfo.description,
  };
}
