// Ankoma parser — convert a raw AnkomaNote into a renderable AnkiCard
// (handles Image-Occlusion, multiple-image, and AP/CP cloze/basic note models).
import { AnkomaNote, AnkiCard } from "../types/anki-card";
import { sanitizeImageSources, transformToR2Url } from "./ankoma-image-utils";

/**
 * Convert AnkomaNote to AnkiCard
 */
export function convertNoteToCard(note: AnkomaNote, deckName: string, index: number): AnkiCard {
  // Extract fields according to Ankoma structure (most AP/CP cloze cards)
  // Field 0: Header
  // Field 1: Text (front of card, with clozes)
  // Field 2: Extra
  // Field 3: Personal Notes
  // Field 4: Textbook (AP cards only)
  // Field 5: Citation
  const fields = note.fields || [];

  // Detect Image Occlusion notes (current variants)
  // Known Note Model UUIDs present in ankoma.json for IOE variants
  const OCCLUSION_UUIDS = new Set([
    "8748b282-73b3-11f0-bc32-8b3dff665248", // IOE +++ (11 fields)
    "877ffc4c-73b3-11f0-bc32-8b3dff665248", // IOE + (compact)
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
        __imageUrls: JSON.stringify(imageUrls), // Store all image URLs for potential UI cycling
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
