// WSI viewer — slide-URL → viewer config resolution (per-repository tiling/iframe rules).
export interface VirtualSlide {
  id: string;
  repository: string;
  category: string;
  subcategory: string;
  diagnosis: string;
  patient_info: string;
  age: string | null;
  gender: string | null;
  clinical_history: string;
  stain_type: string;
  preview_image_url: string;
  slide_url: string;
  case_url: string;
  other_urls: string[];
  source_metadata: Record<string, unknown>;
}

// Props for the unified WSI viewer

export interface WSIConfig {
  canEmbed: boolean;
  useOpenSeadragon: boolean;
  embeddingStrategy: "iframe" | "openseadragon" | "fallback";
  viewerUrl?: string;
  reason?: string;
  // Optional viewport crop (fractions 0-1) to hide a repo's own page chrome
  // (top nav / footer) that surrounds the embedded slide viewer. Distortion-free:
  // the kept band is uniformly scaled up to fill the window. Eyeball-tunable.
  crop?: { top: number; bottom: number };
}

// Helper function to try alternative URLs for blocked repositories
function _tryAlternativeURL(originalUrl: string, slide?: VirtualSlide): string | null {
  try {
    const urlObj = new URL(originalUrl);
    const hostname = urlObj.hostname.toLowerCase();

    // Leeds Virtual Pathology: Try direct image URLs
    if (hostname.includes("virtualpathology.leeds.ac.uk")) {
      // Check if slide has preview_image_url that might be a direct image
      if (
        slide?.preview_image_url &&
        slide.preview_image_url.includes("images.virtualpathology.leeds.ac.uk")
      ) {
        return slide.preview_image_url;
      }

      // Try to construct direct image URL from slide URL
      const pathMatch = originalUrl.match(/path=([^&]+)/);
      if (pathMatch) {
        const decodedPath = decodeURIComponent(pathMatch[1]);
        const directImageUrl = `https://images.virtualpathology.leeds.ac.uk${decodedPath}?-1`;
        return directImageUrl;
      }
    }

    // University of Toronto: Try different viewer approaches
    if (hostname.includes("lmpimg.med.utoronto.ca")) {
      // For now, no alternative - these are already optimized viewer URLs
      return null;
    }

    return null;
  } catch {
    return null;
  }
}

// Step 1: Dragon (OpenSeadragon) initialization and configuration
// Only used within this file — not exported (keeps knip's unused-exports check clean).
export function getWSIConfig(url: string, _repository?: string, _slide?: VirtualSlide): WSIConfig {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    // Check if this is a raw WSI file
    const isRawWSI = /\.(svs|ndpi|scn|vms|vmu|mrxs|tiff?|czi|lsm|oib|oif)(\?|$)/i.test(url);

    // Repository-specific configurations
    if (hostname.includes("supabase.co") && isRawWSI) {
      return {
        canEmbed: true,
        useOpenSeadragon: true,
        embeddingStrategy: "openseadragon",
        reason: "Raw WSI file from Supabase storage",
      };
    }

    if (hostname.includes("upmc.edu")) {
      return {
        canEmbed: true,
        useOpenSeadragon: false,
        embeddingStrategy: "iframe",
        reason: "UPMC supports embedding",
      };
    }

    if (
      hostname.includes("pathpresenter.net") ||
      hostname.includes("pathpresenter.blob.core.windows.net")
    ) {
      return {
        canEmbed: true,
        useOpenSeadragon: false,
        embeddingStrategy: "iframe",
        reason: "PathPresenter supports embedding",
      };
    }

    if (hostname.includes("virtualpathology.leeds.ac.uk")) {
      return {
        canEmbed: false,
        useOpenSeadragon: false,
        embeddingStrategy: "fallback",
        reason: "Leeds Virtual Pathology blocks iframe embedding",
      };
    }

    if (hostname.includes("lmpimg.med.utoronto.ca") || hostname.includes("dlm.lmp.utoronto.ca")) {
      return {
        canEmbed: false,
        useOpenSeadragon: false,
        embeddingStrategy: "fallback",
        reason: "University of Toronto LMP blocks iframe embedding",
      };
    }

    if (hostname.includes("recutclub.com")) {
      return {
        canEmbed: false,
        useOpenSeadragon: false,
        embeddingStrategy: "fallback",
        reason: "Recut Club blocks iframe embedding",
      };
    }

    if (hostname.includes("hematopathologyetutorial.com")) {
      return {
        canEmbed: true,
        useOpenSeadragon: false,
        embeddingStrategy: "iframe",
        reason: "HematopathologyeTutorial supports embedding",
        // Page wraps the OSD viewer in a blue top-nav + tall blue footer; crop both.
        crop: { top: 0.07, bottom: 0.3 },
      };
    }

    if (hostname.includes("rosai.secondslide.com") || hostname.includes("rosaicollection.net")) {
      return {
        canEmbed: true,
        useOpenSeadragon: false,
        embeddingStrategy: "iframe",
        reason: "Rosai Collection supports embedding",
      };
    }

    // AANP / Pitt: viewer URLs end in `.svs` (e.g. /dss/view/<id>/1959-1.svs) but are
    // web viewer pages, not raw files — must iframe, NOT route to OpenSeadragon.
    if (hostname.includes("neuro2.pathology.pitt.edu")) {
      return {
        canEmbed: true,
        useOpenSeadragon: false,
        embeddingStrategy: "iframe",
        reason: "AANP Diagnostic Slide Session supports embedding",
      };
    }

    // Default for raw WSI files
    if (isRawWSI) {
      return {
        canEmbed: true,
        useOpenSeadragon: true,
        embeddingStrategy: "openseadragon",
        reason: "Raw WSI file requires OpenSeadragon",
      };
    }

    // Default for web viewers
    return {
      canEmbed: true,
      useOpenSeadragon: false,
      embeddingStrategy: "iframe",
      reason: "Web-based viewer",
    };
  } catch {
    return {
      canEmbed: false,
      useOpenSeadragon: false,
      embeddingStrategy: "fallback",
      reason: "Invalid URL",
    };
  }
}

// Step 2: OpenSeadragon viewer component
