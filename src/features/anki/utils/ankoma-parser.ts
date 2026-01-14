// src/features/anki/utils/ankoma-parser.ts

import { AnkomaDeck, AnkomaNote, AnkomaSection, AnkomaData, AnkiCard } from "../types/anki-card";
import { transformAnkiMediaUrl } from "@/shared/utils/r2-url-transformer";

/**
 * Sanitize image filenames in HTML to match R2 storage format
 * Replaces ALL whitespace characters (including Unicode spaces) with underscores in image src attributes
 */
function sanitizeImageSources(html: string): string {
  if (!html) return html;

  // Match all img tags and replace ALL whitespace in src attributes with underscores
  return html.replace(
    /<img([^>]*?)src=["']([^"']+)["']([^>]*?)>/gi,
    (match, before, src, after) => {
      // Replace ALL whitespace characters with underscores
      // Includes: regular spaces, non-breaking spaces (U+00A0, U+202F), and other Unicode spaces
      const sanitizedSrc = src.replace(/[\s\u00A0\u2000-\u200B\u202F\uFEFF]/g, "_");
      return `<img${before}src="${sanitizedSrc}"${after}>`;
    }
  );
}

/**
 * Transform image URL to R2 and sanitize whitespace in filename
 */
function transformToR2Url(imagePath: string): string {
  if (!imagePath) return imagePath;
  // First sanitize whitespace in filename, then transform to R2 URL
  const sanitizedPath = imagePath.replace(/[\s\u00A0\u2000-\u200B\u202F\uFEFF]/g, "_");
  return transformAnkiMediaUrl(sanitizedPath);
}

/**
 * Category/Subcategory normalization rules
 * Maps original names to normalized names for consistency
 */
const NAME_NORMALIZATIONS: Record<string, string> = {
  // AP -> Immunohistochemistry: Combine muscle variants
  Muscle: "Muscle",
  "Smooth Muscle": "Muscle",
  "Skeletal Muscle": "Muscle",
  // AP -> Immunohistochemistry: Fix typo
  Myfibroblastic: "Myofibroblastic",
  // AP -> Endocrine: Combine parathyroid variants
  "Parathyroid Adenoma": "Parathyroid",
  // AP -> Forensics: Fix parsing error
  "Natural Deaths#ANKOMA": "Natural Deaths",
  // AP -> Genitourinary: Fix parsing errors
  "Penisand Scrotum": "Penis & Scrotum",
  "Urothelial Tractand Bladder": "Urothelial Tract & Bladder",
  // CP -> Molecular Pathology
  "7.1 7.2": "Molecular Biology & Techniques",
  "7.3": "Non-Neoplastic Molecular Pathology",
  "7.4": "Neoplastic Molecular Pathology",
  // CP -> Medical Directorship
  CLIA88: "CLIA",
  "Professional Component Billing": "Billing",
  "Laboratory Test Panels": "Billing",
  "Billing Regulations": "Billing",
  "Quality Assurance": "Quality Control",
  "Quality Management": "Quality Control",
  "Quality Improvement": "Quality Control",
  "Statistical Quality Control": "Quality Control",
  "Medicareand Medicaid": "Medicare & Medicaid",
  // CP -> Immunology
  BCells: "B Cells",
  TCells: "T Cells",
  NKCells: "NK Cells",
  HLATesting: "HLA Testing",
  APCs: "Antigen Processing Cells",
  COmplement: "Complement System",
  // CP -> Chemistry
  "#techniques": "Techniques",
  proteins: "Protein Analysis",
  "Quick Compendium": "General Principles",
  preanalytical: "General Principles",
  miscellaneous: "General Principles",
  // CP -> Transfusion Medicine
  "QUick Compendium": "General Principles",
  "Special Circumstances": "General Principles",
  Extras: "General Principles",
  "Passenger Lymphocytes Syndrome": "General Principles",
  // CP -> Hemepath Benign
  "#Peripheral Blood Smears": "Peripheral Blood Smears",
  "Methods & misc": "General Principles",
};

/**
 * Parent-specific normalization rules
 * Key format: "parent::child" where parent is the immediate parent category
 */
const PARENT_SPECIFIC_NORMALIZATIONS: Record<string, string> = {
  // These are context-specific to avoid false positives
  "Chemistry::proteins": "Protein Analysis",
  "Chemistry::Quick Compendium": "General Principles",
  "Chemistry::preanalytical": "General Principles",
  "Chemistry::miscellaneous": "General Principles",
  "Transfusion Medicine::Quick Compendium": "General Principles",
  "Transfusion Medicine::QUick Compendium": "General Principles",
  "Transfusion Medicine::Special Circumstances": "General Principles",
  "Transfusion Medicine::Extras": "General Principles",
  "Transfusion Medicine::Passenger Lymphocytes Syndrome": "General Principles",
  "Hemepath Benign::Methods & misc": "General Principles",
};

/**
 * Category merge rules - categories that should be combined
 * Key is the source category path, value is the target category path
 */
const CATEGORY_MERGES: Record<string, string> = {
  // AP -> Pulmonary combine with AP -> Thoracic -> Pulmonary
  "AP::Pulmonary": "AP::Thoracic::Pulmonary",
  // CP -> Benign Heme combine with CP -> Hemepath Benign
  "CP::Benign Heme": "CP::Hemepath Benign",
  // CP -> Hemepath change to CP -> Hemepath Neoplastic
  "CP::Hemepath": "CP::Hemepath Neoplastic",
};

/**
 * Microbiology subcategories that are valid - everything else goes to General Principles
 */
const MICROBIOLOGY_VALID_SUBCATEGORIES = [
  "Bacteriology",
  "Mycology",
  "Parasitology",
  "Virology",
  "General Principles",
];

/**
 * Normalize a category/subcategory name
 */
function normalizeName(name: string, parentPath: string[] = []): string {
  const originalName = name.trim();
  let normalized = originalName;

  // Check direct name normalizations FIRST (before any modifications)
  // This handles cases like '#techniques', '#Peripheral Blood Smears', etc.
  if (NAME_NORMALIZATIONS[originalName]) {
    return NAME_NORMALIZATIONS[originalName];
  }

  // Check parent-specific normalizations with original name
  if (parentPath.length > 0) {
    const parent = parentPath[parentPath.length - 1];
    const parentKey = `${parent}::${originalName}`;
    if (PARENT_SPECIFIC_NORMALIZATIONS[parentKey]) {
      return PARENT_SPECIFIC_NORMALIZATIONS[parentKey];
    }
  }

  // Remove leading # characters
  if (normalized.startsWith("#")) {
    normalized = normalized.substring(1).trim();
  }

  // Check normalizations again after stripping #
  if (NAME_NORMALIZATIONS[normalized]) {
    normalized = NAME_NORMALIZATIONS[normalized];
  }

  // Check parent-specific normalizations with stripped name
  if (parentPath.length > 0) {
    const parent = parentPath[parentPath.length - 1];
    const parentKey = `${parent}::${normalized}`;
    if (PARENT_SPECIFIC_NORMALIZATIONS[parentKey]) {
      normalized = PARENT_SPECIFIC_NORMALIZATIONS[parentKey];
    }
  }

  // Fix parsing errors (missing spaces before 'and')
  normalized = normalized.replace(/(\w)and(\s)/g, "$1 And$2");
  normalized = normalized.replace(/(\w)and$/g, "$1 And");

  // Replace 'and' with '&' (case insensitive, whole word)
  normalized = normalized.replace(/\band\b/gi, "&");

  // Ensure sentence case (capitalize first letter, rest as-is for proper nouns)
  if (normalized.length > 0) {
    normalized = normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }

  // Special handling for Microbiology subcategories
  if (parentPath.some((p) => p.includes("Microbiology"))) {
    if (!MICROBIOLOGY_VALID_SUBCATEGORIES.includes(normalized)) {
      normalized = "General Principles";
    }
  }

  return normalized;
}

/**
 * Check if a category path should be merged into another
 */
function getMergeTarget(path: string[]): string[] | null {
  const pathStr = path.join("::");
  for (const [source, target] of Object.entries(CATEGORY_MERGES)) {
    if (pathStr === source || pathStr.startsWith(source + "::")) {
      const targetParts = target.split("::");
      if (pathStr.startsWith(source + "::")) {
        // Preserve subcategories under the merged path
        const remainder = pathStr.substring(source.length + 2);
        return [...targetParts, ...remainder.split("::")];
      }
      return targetParts;
    }
  }
  return null;
}

/**
 * Merge subsections with the same normalized name
 */
function mergeSubsections(subsections: AnkomaSection[]): AnkomaSection[] {
  const merged = new Map<string, AnkomaSection>();

  for (const section of subsections) {
    const existing = merged.get(section.name);
    if (existing) {
      // Merge cards and subsections
      existing.cards.push(...section.cards);
      existing.cardCount += section.cardCount;
      existing.subsections.push(...section.subsections);
      // Recursively merge the combined subsections
      existing.subsections = mergeSubsections(existing.subsections);
    } else {
      // Recursively merge this section's subsections first
      const mergedSection = { ...section, subsections: mergeSubsections(section.subsections) };
      merged.set(section.name, mergedSection);
    }
  }

  return Array.from(merged.values());
}

/**
 * Parse ankoma.json structure into organized sections
 */
export function parseAnkomaData(rawData: AnkomaDeck): AnkomaData {
  let totalCards = 0;

  function processDeck(deck: AnkomaDeck, path: string[] = []): AnkomaSection[] {
    // Normalize the deck name
    const normalizedName = normalizeName(deck.name, path);
    const currentPath = [...path, normalizedName];

    // Check if this path should be merged into another
    const mergeTarget = getMergeTarget(currentPath);
    const effectivePath = mergeTarget || currentPath;
    const effectiveName = effectivePath[effectivePath.length - 1];

    const processedSections: AnkomaSection[] = [];

    // Convert notes to cards
    const cards =
      deck.notes?.map((note, index) => convertNoteToCard(note, effectiveName, index)) || [];
    totalCards += cards.length;

    // Process subsections (children)
    let subsections: AnkomaSection[] = [];
    if (deck.children && deck.children.length > 0) {
      for (const child of deck.children) {
        const childSections = processDeck(child, effectivePath);
        subsections.push(...childSections);
      }
    }

    // Merge subsections with the same normalized name
    subsections = mergeSubsections(subsections);

    // Create section if it has cards or meaningful subsections
    if (cards.length > 0 || subsections.length > 0) {
      const section: AnkomaSection = {
        id: generateSectionId(effectivePath),
        name: effectiveName,
        path: effectivePath,
        cardCount: cards.length,
        cards,
        subsections,
      };
      processedSections.push(section);
    }

    return processedSections;
  }

  // Process the root deck
  let processedSections: AnkomaSection[] = [];
  if (rawData.children) {
    for (const child of rawData.children) {
      const childSections = processDeck(child);
      processedSections.push(...childSections);
    }
  }

  // Final merge pass for top-level sections
  processedSections = mergeSubsections(processedSections);

  return {
    sections: processedSections,
    totalCards,
    lastLoaded: new Date(),
  };
}

/**
 * Convert AnkomaNote to AnkiCard
 */
function convertNoteToCard(note: AnkomaNote, deckName: string, index: number): AnkiCard {
  // Extract fields according to Ankoma structure (most AP/CP cloze cards)
  // Field 0: Header
  // Field 1: Text (front of card, with clozes)
  // Field 2: Extra
  // Field 3: Personal Notes
  // Field 4: Textbook (AP cards only)
  // Field 5: Citation
  const fields = note.fields || [];

  // Detect Image Occlusion notes (all variants)
  // Known Note Model UUIDs present in ankoma.json for IOE variants
  const OCCLUSION_UUIDS = new Set([
    "8748b282-73b3-11f0-bc32-8b3dff665248", // IOE +++ (11 fields)
    "877ffc4c-73b3-11f0-bc32-8b3dff665248", // IOE + (compact)
    "8745afec-73b3-11f0-bc32-8b3dff665248", // Legacy Image Occlusion
  ]);

  // Heuristic: any field with inline <svg> or reference to an .svg mask or -Q.svg/-A.svg filenames
  const fieldContainsSvg = (s?: string) =>
    !!s && (s.includes("<svg") || /\.svg(\"|')?/.test(s) || /-Q\.svg|-A\.svg/i.test(s));
  const anySvg = fields.some((f) => fieldContainsSvg(f));

  const looksLikeIOE = OCCLUSION_UUIDS.has(note.note_model_uuid) || anySvg;

  if (looksLikeIOE) {
    const idHidden = fields[0] || "";
    const header = fields[1] || "";
    const image = fields[2] || "";
    const footer = fields[3] || "";
    const remarks = fields[4] || "";
    const sources = fields[5] || "";
    const extra1 = fields[6] || "";
    const extra2 = fields[7] || "";
    const qMask = fields[8] || "";
    const aMask = fields[9] || "";
    const oMask = fields[10] || "";

    // Build question/answer HTML replicating the IOE template
    const questionHtml = sanitizeImageSources(
      `
      <div id="io-header">${header}</div>
      <div id="io-wrapper">
        <div id="io-overlay">${qMask}</div>
        <div id="io-original">${image}</div>
      </div>
      ${footer ? `<div id=\"io-footer\">${footer}</div>` : ""}
    `.trim()
    );

    const answerExtras: string[] = [];
    if (remarks.trim()) {
      answerExtras.push(
        `<div class="io-extra-entry"><div class="io-field-descr">Remarks</div>${remarks}</div>`
      );
    }
    if (sources.trim()) {
      answerExtras.push(
        `<div class="io-extra-entry"><div class="io-field-descr">Sources</div>${sources}</div>`
      );
    }
    if (extra1.trim()) {
      answerExtras.push(
        `<div class="io-extra-entry"><div class="io-field-descr">Extra 1</div>${extra1}</div>`
      );
    }
    if (extra2.trim()) {
      answerExtras.push(
        `<div class="io-extra-entry"><div class="io-field-descr">Extra 2</div>${extra2}</div>`
      );
    }

    const answerHtml = sanitizeImageSources(
      `
      <div id="io-header">${header}</div>
      <div id="io-wrapper">
        <div id="io-overlay">${aMask || qMask}</div>
        <div id="io-original">${image}</div>
      </div>
      ${footer ? `<div id=\"io-footer\">${footer}</div>` : ""}
      ${answerExtras.length ? `<div id=\"io-extra-wrapper\"><div id=\"io-extra\">${answerExtras.join("")}</div></div>` : ""}
    `.trim()
    );

    return {
      id: note.guid || `${deckName}-${index}`,
      cardId: index + 1,
      noteId: parseInt(note.guid?.replace(/[^0-9]/g, "") || "0") || index,
      deckName,
      modelName: "Image Occlusion Enhanced+++",
      fields: {
        "ID (hidden)": idHidden,
        Header: header,
        Image: image,
        Footer: footer,
        Remarks: remarks,
        Sources: sources,
        "Extra 1": extra1,
        "Extra 2": extra2,
        "Question Mask": qMask,
        "Answer Mask": aMask,
        "Original Mask": oMask,
      },
      tags: [...(note.tags || []), "#image-occlusion"],
      question: questionHtml,
      answer: answerHtml,
      css: "",
      interval: 1,
      due: Date.now() + 24 * 60 * 60 * 1000,
      factor: 2500,
      reviews: 0,
      lapses: 0,
      left: 0,
      ord: 0,
      type: 0,
      queue: 0,
      mod: Date.now(),
      usn: 1,
      reps: 0,
      ease: 2500,
    };
  }

  // Detect card type UUIDs
  const AP_MODEL_UUID = "cb0c02c4-e328-11ef-a4df-cf9f22b82781";
  const CP_MODEL_UUID = "cb0a45d8-e328-11ef-a4df-cf9f22b82781";
  const AP_MULTIPLE_IMAGES_UUID = "24d0854c-de36-11f0-a3ab-21da8ea55a13"; // Cloze-Ankoma-AP - multiple images

  const isAPModel = note.note_model_uuid === AP_MODEL_UUID;
  const isCPModel = note.note_model_uuid === CP_MODEL_UUID;
  const isAPMultipleImages = note.note_model_uuid === AP_MULTIPLE_IMAGES_UUID;
  const tags = note.tags || [];

  // Handle "multiple images" card type - displays ONE random image from Images field
  if (isAPMultipleImages) {
    // Field structure for AP multiple images (Ankoma-AP Multiple Images):
    // [0]=Header (e.g., "Peripheral Blood smear")
    // [1]=Text (cloze text, e.g., "cell: {{c1::lymphocyte}}")
    // [2]=Images (multiple <img> tags - one shown randomly on front)
    // [3]=Extra (explanation - shown on back)
    // [4]=Personal Notes (optional)
    // [5]=Textbook (optional)
    // [6]=Citation (optional)
    const header = fields[0] || "";
    const text = fields[1] || "";
    const imagesField = fields[2] || "";
    const extra = fields[3] || "";
    const personalNotes = fields[4] || "";
    const textbook = fields[5] || "";
    const citation = fields[6] || "";

    // Extract all image URLs from the Images field and transform to R2 URLs
    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    const imageMatches = Array.from(imagesField.matchAll(imgRegex));
    // Transform each image URL to use R2 storage
    const imageUrls = imageMatches.map((match) => transformToR2Url(match[1]));

    // Select a random image for display (will be consistent per card due to note.guid)
    let selectedImageUrl = "";
    if (imageUrls.length > 0) {
      // Use the card's guid to seed the random selection (consistent selection per card)
      const seed = parseInt(note.guid?.replace(/[^0-9]/g, "") || "0") || index;
      const selectedIndex = seed % imageUrls.length;
      selectedImageUrl = imageUrls[selectedIndex];
    }

    // Build question HTML: Header + Text (with cloze) + ONE random image from Images field
    // Note: selectedImageUrl is already transformed to R2 URL
    const questionHtml = sanitizeImageSources(
      `
      ${header ? `<div class="card-header">${header}</div>` : ""}
      <div class="card-text">${text}</div>
      ${selectedImageUrl ? `<div class="card-image"><img src="${selectedImageUrl}" alt="Question image" /></div>` : ""}
    `.trim()
    );

    // Build answer HTML with all additional fields
    const answerParts = [];

    if (extra.trim()) {
      answerParts.push(sanitizeImageSources(`<div class="extra-section">${extra}</div>`));
    }

    if (personalNotes.trim()) {
      answerParts.push(
        sanitizeImageSources(
          `<div class="personal-notes-section"><h4>Personal Notes</h4>${personalNotes}</div>`
        )
      );
    }

    if (textbook.trim()) {
      answerParts.push(
        sanitizeImageSources(`<div class="textbook-section"><h4>Textbook</h4>${textbook}</div>`)
      );
    }

    if (citation.trim()) {
      const citations = citation
        .split(/(?:<br\s*\/?>){2,}|(?:\n\s*){2,}/)
        .map((c) => c.trim())
        .filter((c) => c.length > 0);

      if (citations.length > 1) {
        const formattedCitations = citations
          .map((cite, i) => (i > 0 ? `<div style="margin-top: 4px;">${cite}</div>` : cite))
          .join("");
        answerParts.push(
          sanitizeImageSources(
            `<div class="citation-section"><h4>Citation</h4>${formattedCitations}</div>`
          )
        );
      } else {
        answerParts.push(
          sanitizeImageSources(`<div class="citation-section"><h4>Citation</h4>${citation}</div>`)
        );
      }
    }

    const answerHtml = answerParts.join("");

    return {
      id: note.guid || `${deckName}-${index}`,
      cardId: index + 1,
      noteId: parseInt(note.guid?.replace(/[^0-9]/g, "") || "0") || index,
      deckName,
      modelName: "Cloze (Multiple Images)",
      fields: {
        Header: header,
        Text: text,
        Images: imagesField,
        Extra: extra,
        "Personal Notes": personalNotes,
        Textbook: textbook,
        Citation: citation,
        __imageUrls: imageUrls, // Store all image URLs for potential UI cycling
        __selectedImageUrl: selectedImageUrl, // Store the selected random image
      },
      tags: [...tags, "#multiple-images"],
      question: questionHtml,
      answer: answerHtml,
      css: "",
      interval: 1,
      due: Date.now() + 24 * 60 * 60 * 1000,
      factor: 2500,
      reviews: 0,
      lapses: 0,
      left: 0,
      ord: 0,
      type: 0,
      queue: 0,
      mod: Date.now(),
      usn: 1,
      reps: 0,
      ease: 2500,
    };
  }

  // Default (Cloze/Basic) path
  // Detect CP vs AP to map fields correctly (CP typically uses different field order)

  // Hemepath Neoplastic uses AP format, Hemepath Benign uses CP format
  const isHemepathNeoplastic =
    tags.some((t) => t.includes("Hemepath-Neoplastic")) || deckName.includes("Neoplastic");
  const isHemepathBenign =
    tags.some((t) => t.includes("Hemepath-Benign")) || deckName.includes("Benign");
  const isCPTag = tags.some(
    (t) => t.startsWith("#ANKOMA::CP::") && !t.includes("Hemepath-Neoplastic")
  );

  // Check deck path for CP indicators
  const deckPathHasCP =
    deckName.toLowerCase().includes("- cp") ||
    deckName.toLowerCase().includes("cp -") ||
    deckName.toLowerCase().includes("clinical pathology");

  // Determine format: AP uses fields[1]=Text, CP uses fields[0]=Text
  const treatAsAP =
    isAPModel ||
    isHemepathNeoplastic ||
    (!isCPModel && !isHemepathBenign && !isCPTag && !deckPathHasCP);
  const isCP = !treatAsAP && (isCPModel || isHemepathBenign || isCPTag || deckPathHasCP);

  // For CP vs AP, the field order differs. Map explicitly.
  let header: string;
  let text: string;
  let extra: string;
  let personalNotes: string;
  let textbook: string;
  let citation: string;

  // Heuristic: If fields[0] is empty but fields[1] has content, it's likely AP format
  // If fields[0] has content with clozes, it's likely CP format
  const field0HasClozes = (fields[0] || "").includes("{{c");
  const field1HasClozes = (fields[1] || "").includes("{{c");
  const field0IsEmpty = !(fields[0] || "").trim();
  const field1IsEmpty = !(fields[1] || "").trim();

  // Smart detection: if field[0] is empty and field[1] has content, use AP format
  // If field[0] has clozes and field[1] is empty or doesn't have clozes, use CP format
  const useAPFormat =
    treatAsAP || (field0IsEmpty && !field1IsEmpty) || (!field0HasClozes && field1HasClozes);
  const useCPFormat =
    isCP ||
    (field0HasClozes && !field1HasClozes) ||
    (!field0IsEmpty && field1IsEmpty && !useAPFormat);

  if (useCPFormat && !useAPFormat) {
    // CP cards: [0]=Text, [1]=Extra, [2]=Personal Notes, [3]=Citation (sometimes [5])
    header = "";
    text = fields[0] || "";
    extra = fields[1] || "";
    personalNotes = fields[2] || "";
    textbook = "";
    citation = fields[3] || fields[5] || "";
  } else {
    // AP/basic (default for Hemepath): [0]=Header, [1]=Text, [2]=Extra, [3]=Personal Notes, [4]=Textbook, [5]=Citation
    header = fields[0] || "";
    text = fields[1] || "";
    extra = fields[2] || "";
    personalNotes = fields[3] || "";
    textbook = fields[4] || "";
    citation = fields[5] || "";
  }

  // Build the answer (back of card) from Extra, Personal Notes, Textbook, and Citation
  const answerParts = [];

  if (extra.trim()) {
    answerParts.push(sanitizeImageSources(`<div class=\"extra-section\">${extra}</div>`));
  }

  if (personalNotes.trim()) {
    answerParts.push(
      sanitizeImageSources(
        `<div class=\"personal-notes-section\"><h4>Personal Notes</h4>${personalNotes}</div>`
      )
    );
  }

  if (textbook.trim()) {
    answerParts.push(
      sanitizeImageSources(`<div class=\"textbook-section\"><h4>Textbook</h4>${textbook}</div>`)
    );
  }

  if (citation.trim()) {
    // Split multiple citations and format them properly
    const citations = citation
      .split(/(?:<br\s*\/?>){2,}|(?:\n\s*){2,}/)
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

    if (citations.length > 1) {
      // Multiple citations - minimal spacing without borders
      const formattedCitations = citations
        .map((cite, index) => (index > 0 ? `<div style="margin-top: 4px;">${cite}</div>` : cite))
        .join("");
      answerParts.push(
        sanitizeImageSources(
          `<div class=\"citation-section\"><h4>Citation</h4>${formattedCitations}</div>`
        )
      );
    } else {
      // Single citation
      answerParts.push(
        sanitizeImageSources(`<div class=\"citation-section\"><h4>Citation</h4>${citation}</div>`)
      );
    }
  }

  const answer = answerParts.join("");

  // Determine card type based on content
  let modelName = "Basic";

  if (text.includes("{{c") && text.includes("::")) {
    modelName = "Cloze";
  }

  return {
    id: note.guid || `${deckName}-${index}`,
    cardId: index + 1,
    noteId: parseInt(note.guid?.replace(/[^0-9]/g, "") || "0") || index,
    deckName,
    modelName,
    fields: {
      Header: sanitizeImageSources(header),
      Text: sanitizeImageSources(text),
      Extra: sanitizeImageSources(extra),
      "Personal Notes": sanitizeImageSources(personalNotes),
      Textbook: sanitizeImageSources(textbook),
      Citation: sanitizeImageSources(citation),
    },
    tags: note.tags || [],
    question: sanitizeImageSources(text),
    answer,
    css: "",
    interval: 1,
    due: Date.now() + 24 * 60 * 60 * 1000,
    factor: 2500,
    reviews: 0,
    lapses: 0,
    left: 0,
    ord: 0,
    type: 0,
    queue: 0,
    mod: Date.now(),
    usn: 1,
    reps: 0,
    ease: 2500,
  };
}

/**
 * Generate unique section ID from path
 */
function generateSectionId(path: string[]): string {
  return path
    .join("::")
    .toLowerCase()
    .replace(/[^a-z0-9:]/g, "-");
}

/**
 * Find section by ID
 */
export function findSectionById(sections: AnkomaSection[], id: string): AnkomaSection | null {
  for (const section of sections) {
    if (section.id === id) {
      return section;
    }

    const found = findSectionById(section.subsections, id);
    if (found) {
      return found;
    }
  }

  return null;
}

/**
 * Get all cards from a section and its subsections
 */
export function getAllCardsFromSection(section: AnkomaSection): AnkiCard[] {
  const cards = [...section.cards];

  for (const subsection of section.subsections) {
    cards.push(...getAllCardsFromSection(subsection));
  }

  return cards;
}

/**
 * Get section statistics
 */
export function getSectionStats(section: AnkomaSection): {
  totalCards: number;
  directCards: number;
  subsectionCount: number;
  maxDepth: number;
} {
  const directCards = section.cards.length;
  let totalCards = directCards;
  let maxDepth = 1;

  for (const subsection of section.subsections) {
    const subStats = getSectionStats(subsection);
    totalCards += subStats.totalCards;
    maxDepth = Math.max(maxDepth, subStats.maxDepth + 1);
  }

  return {
    totalCards,
    directCards,
    subsectionCount: section.subsections.length,
    maxDepth,
  };
}

/**
 * Create a flattened list of all sections for easy navigation
 */
export function flattenSections(sections: AnkomaSection[]): AnkomaSection[] {
  const flattened: AnkomaSection[] = [];

  function flatten(sectionList: AnkomaSection[]) {
    for (const section of sectionList) {
      flattened.push(section);
      if (section.subsections.length > 0) {
        flatten(section.subsections);
      }
    }
  }

  flatten(sections);
  return flattened;
}

/**
 * Filter sections by name or content
 */
export function filterSections(sections: AnkomaSection[], query: string): AnkomaSection[] {
  const queryLower = query.toLowerCase();

  return sections.filter((section) => {
    // Check section name
    if (section.name.toLowerCase().includes(queryLower)) {
      return true;
    }

    // Check if any cards contain the query
    const hasMatchingCard = section.cards.some(
      (card) =>
        card.question.toLowerCase().includes(queryLower) ||
        card.answer.toLowerCase().includes(queryLower) ||
        card.tags.some((tag) => tag.toLowerCase().includes(queryLower))
    );

    if (hasMatchingCard) {
      return true;
    }

    // Check subsections
    const hasMatchingSubsection = filterSections(section.subsections, query).length > 0;
    return hasMatchingSubsection;
  });
}

/**
 * Load ankoma data directly from R2 with client-side caching
 * @deprecated Use useClientAnkoma hook instead for better performance and Vercel cost savings
 */
export async function loadAnkomaData(): Promise<AnkomaData> {
  try {
    console.log("🚀 Loading ankoma.json directly from R2...");

    const { ANKOMA_JSON_URL } = await import("@/shared/config/ankoma");

    const response = await fetch(ANKOMA_JSON_URL, {
      cache: "force-cache", // Aggressive browser caching
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ankoma.json: ${response.status} ${response.statusText}`);
    }

    const rawData: AnkomaDeck = await response.json();
    const parsedData = parseAnkomaData(rawData);

    console.log(
      `🎉 Successfully loaded ${parsedData.totalCards.toLocaleString()} cards from R2 - your brain is about to get a workout!`
    );

    return parsedData;
  } catch (error) {
    console.error("Error loading ankoma data:", error);
    throw new Error(
      `Failed to load Anki deck data: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}
