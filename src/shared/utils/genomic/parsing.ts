/**
 * Variant text parsing utilities
 * Extracts genomic identifiers from free-text variant descriptions
 */

import { ParsedVariant } from "./types";

export function parseVariantText(text: string): ParsedVariant {
  const result: ParsedVariant = {
    gene: null,
    hgvs_g: null,
    hgvs_c: null,
    hgvs_p: null,
    transcript: null,
    vaf: null,
    isComplex: false,
  };

  // Extract gene symbol
  const geneMatch = text.match(/\b([A-Z][A-Z0-9]{1,10})\b/);
  if (geneMatch) result.gene = geneMatch[1];

  // Extract VCF-style notation (chr:pos:ref:alt)
  const vcfMatch = text.match(/(\d+):(\d+):([ACGT]+):([ACGT]+)/i);
  if (vcfMatch) {
    const [, chr, pos, ref, alt] = vcfMatch;
    result.hgvs_g = `chr${chr}:g.${pos}${ref}>${alt}`;
  }

  // Extract HGVS genomic notation (fallback if VCF not found)
  if (!result.hgvs_g) {
    const hgvsGMatch = text.match(
      /(chr\d+|NC_\d+\.\d+):g\.(\d+)([A-Z]>[A-Z]|del[A-Z]+|ins[A-Z]+|dup[A-Z]*|_\d+del|_\d+dup)/i
    );
    if (hgvsGMatch) result.hgvs_g = hgvsGMatch[0];
  }

  // Extract HGVS coding notation (with c. prefix)
  const hgvsCMatch = text.match(
    /c\.(\d+(?:_\d+)?)(del(?:[A-Z]+|\d+)?|ins(?:[A-Z]+|\d+)?|dup(?:[A-Z]+|\d+)?|[A-Z]>[A-Z])/i
  );
  if (hgvsCMatch) {
    result.hgvs_c = hgvsCMatch[0];
    result.isComplex = /del|ins|dup|_/.test(hgvsCMatch[0]);
  }

  // Extract bare coding notation without c. prefix (e.g., "5266dupC", "5266dup", "185delAG", "2235_2249del15")
  if (!result.hgvs_c) {
    const bareMatch = text.match(
      /\b(\d+(?:_\d+)?)(del(?:[A-Z]+|\d+)?|ins(?:[A-Z]+|\d+)?|dup(?:[A-Z]+|\d+)?)\b/i
    );
    if (bareMatch && bareMatch[0].length >= 4) {
      // Ensure at least "1dup" minimum length to avoid false positives
      result.hgvs_c = `c.${bareMatch[0]}`;
      result.isComplex = true;
    }
  }

  // Extract HGVS protein notation
  const hgvsPMatch = text.match(
    /p\.([A-Z][a-z]{2}\d+[A-Z][a-z]{2}|[A-Z]\d+[A-Z]|[A-Z]\d+fs|[A-Z]\d+\*)/i
  );
  if (hgvsPMatch) {
    result.hgvs_p = hgvsPMatch[0];
  } else {
    // Extract short protein notation (e.g., D94H, V600E, Q1329*)
    // Pattern matches: Single letter + digits + (single letter OR fs OR *)
    const shortProtMatches = text.match(/\b([A-Z]\d+(?:[A-Z](?:fs)?|\*|fs))(?:\b|\s|$)/g);
    if (shortProtMatches) {
      for (const matchedText of shortProtMatches) {
        const cleanMatch = matchedText.match(/([A-Z]\d+(?:[A-Z](?:fs)?|\*|fs))/)?.[1];
        // Avoid matching if it's part of the gene name
        // Also avoid matching transcript IDs (they have underscores or periods nearby)
        if (cleanMatch && (!result.gene || !result.gene.includes(cleanMatch))) {
          // Additional check: make sure it's not immediately after NM_ or NP_ (within 5 chars)
          const matchIndex = text.indexOf(cleanMatch);
          const precedingText = text.substring(Math.max(0, matchIndex - 5), matchIndex);
          if (!precedingText.match(/NM_|NP_|ENST/)) {
            result.hgvs_p = `p.${cleanMatch}`;
            break;
          }
        }
      }
    }
  }

  // Extract transcript ID
  const transcriptMatch = text.match(/(NM_\d+\.\d+|ENST\d+\.\d+)/i);
  if (transcriptMatch) result.transcript = transcriptMatch[1];

  // Extract VAF
  const vafMatch = text.match(/VAF[:\s]*(\d+\.?\d*)%?/i);
  if (vafMatch) result.vaf = parseFloat(vafMatch[1]);

  // Legacy fields
  const rsidMatch = text.match(/rs\d+/i);
  if (rsidMatch) result.rsid = rsidMatch[0];

  const mutationMatches = text.match(/\b([A-Z]\d+(?:[A-Z](?:fs)?|\*|fs))(?:\b|\s|$)/g);
  if (mutationMatches) {
    for (const matchedText of mutationMatches) {
      const cleanMatch = matchedText.match(/([A-Z]\d+(?:[A-Z](?:fs)?|\*|fs))/)?.[1];
      if (cleanMatch && (!result.gene || !result.gene.includes(cleanMatch))) {
        result.mutation = cleanMatch;
        break;
      }
    }
  }

  const cdnaMatch = text.match(/c\.\d+[A-Z]>[A-Z]/i);
  if (cdnaMatch) result.cdna = cdnaMatch[0];

  return result;
}
