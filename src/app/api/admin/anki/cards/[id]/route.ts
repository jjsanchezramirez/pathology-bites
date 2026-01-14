// src/app/api/admin/anki/cards/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAnkiCardByNoteId, getAnkiCardByGuid } from '@/features/anki/services/anki-loader';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Try to parse as number first (for backwards compatibility with noteId)
    const noteId = parseInt(id, 10);
    let card = null;

    if (!isNaN(noteId)) {
      // If it's a number, try to find by noteId
      card = await getAnkiCardByNoteId(noteId);
    } else {
      // Otherwise treat it as a GUID
      card = await getAnkiCardByGuid(id);
    }

    if (!card) {
      return NextResponse.json(
        {
          success: false,
          error: 'Card not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      card,
    });
  } catch (error) {
    console.error('Error fetching Anki card:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch Anki card',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
