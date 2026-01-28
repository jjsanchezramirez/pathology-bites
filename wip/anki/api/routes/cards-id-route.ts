// wip/anki/api/routes/cards-id-route.ts
/**
 * ⚠️ WORK IN PROGRESS - NOT CURRENTLY USED ⚠️
 *
 * API route for fetching individual Anki cards by ID
 *
 * THEORETICAL USE CASE:
 * This endpoint would allow fetching individual Anki flashcards from the ankoma.json
 * dataset via a Vercel API route. Supports lookup by:
 * - noteId (numeric ID) - for backwards compatibility
 * - guid (string GUID) - standard Anki identifier
 *
 * CURRENT STATUS:
 * The Anki feature at /dashboard/anki works perfectly but doesn't use this endpoint.
 * Instead, it loads the entire ankoma.json file directly from R2 on the client side
 * (via use-client-ankoma.ts hook) which is:
 * - Faster (no Vercel API call overhead)
 * - More cost-efficient (no Vercel bandwidth/invocations)
 * - Simpler (client-side caching, direct CDN access)
 *
 * WHEN TO USE THIS:
 * Only implement this if you need:
 * - Server-side card filtering or authorization
 * - Dynamic card generation based on user permissions
 * - Integration with other server-side services
 *
 * For the current read-only flashcard viewer, direct R2 access is better.
 *
 * ORIGINAL LOCATION: src/app/api/admin/anki/cards/[id]/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
// Note: This import path would need to be updated if reintegrated
// import { getAnkiCardByNoteId, getAnkiCardByGuid } from "@/features/anki/services/anki-loader";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // Try to parse as number first (for backwards compatibility with noteId)
    const noteId = parseInt(id, 10);
    let card = null;

    if (!isNaN(noteId)) {
      // If it's a number, try to find by noteId
      // card = await getAnkiCardByNoteId(noteId);
      card = null; // Placeholder
    } else {
      // Otherwise treat it as a GUID
      // card = await getAnkiCardByGuid(id);
      card = null; // Placeholder
    }

    if (!card) {
      return NextResponse.json(
        {
          success: false,
          error: "Card not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      card,
    });
  } catch (error) {
    console.error("Error fetching Anki card:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch Anki card",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
