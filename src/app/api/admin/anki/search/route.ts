// src/app/api/admin/anki/search/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { searchAnkiCards, formatCardForSearch } from '@/features/anki/services/anki-loader';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';

    // Search for cards
    const cards = await searchAnkiCards(query);

    // Format results for response
    const results = cards.map(formatCardForSearch);

    return NextResponse.json({
      success: true,
      count: results.length,
      results,
    });
  } catch (error) {
    console.error('Error searching Anki cards:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to search Anki cards',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
