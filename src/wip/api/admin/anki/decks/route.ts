// src/app/api/admin/anki/decks/route.ts
import { NextResponse } from "next/server";
import { getAnkiDecks } from "@/features/anki/services/anki-loader";

export async function GET() {
  try {
    const decks = await getAnkiDecks();

    return NextResponse.json({
      success: true,
      decks,
    });
  } catch (error) {
    console.error("Error fetching Anki decks:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch Anki decks",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
