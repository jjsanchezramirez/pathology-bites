# Anki API Route - Work in Progress

⚠️ **NOT CURRENTLY USED** ⚠️

## What This Is

A server-side API route for fetching individual Anki flashcards from the `ankoma.json` dataset stored in R2.

## Why It's Not Used

The Anki flashcard viewer at `/dashboard/anki` works perfectly **without** this API route because:

1. **Direct R2 Access** - Client loads `ankoma.json` directly from R2 CDN
2. **Better Performance** - No Vercel API call overhead
3. **Cost Efficient** - Zero Vercel bandwidth and function invocations
4. **Simpler Architecture** - Client-side caching with direct CDN access
5. **Read-Only Feature** - No server-side processing or authorization needed

The `use-client-ankoma.ts` hook fetches the entire Anki deck once, caches it, and provides instant card navigation.

## What the Anki Feature Does

**Location:** `/dashboard/anki`

**Features:**
- Displays Anki flashcards from the `ankoma.json` dataset
- Supports multiple card types:
  - Basic cards (front/back)
  - Cloze deletion cards (fill-in-the-blank)
  - Image cards
  - Rich HTML content
- Interactive study mode with card navigation
- Progress tracking
- Full cloze navigation for multi-cloze cards

**Data Source:**
- R2 Storage: `${DATA_BASE}/anki/ankoma.json`
- Public access via Cloudflare CDN
- Client-side fetching with session-level caching

## What This API Route Would Do

**Original location:** `/api/admin/anki/cards/[id]`

**Functionality:**
- Fetch individual cards by ID (noteId or guid)
- Server-side card lookup from ankoma.json
- Returns single card with full metadata

**Why it was built:**
Likely created as a server-side endpoint for card retrieval, but the implementation went client-side instead (better performance).

## When You Would Use This

Only reintegrate this API route if you need:

1. **Server-Side Authorization** - Restrict card access based on user roles
2. **Dynamic Filtering** - Generate personalized card sets server-side
3. **Private Content** - Make ankoma.json private and gate access
4. **Server Integration** - Connect with other backend services
5. **Rate Limiting** - Control client access to card data

For a **read-only public flashcard viewer**, the current direct R2 approach is superior.

## File Structure

```
wip/anki/
└── api/
    └── routes/
        └── cards-id-route.ts  # GET /api/admin/anki/cards/[id]
```

## Reintegrating This Code

If you decide to use server-side card fetching:

1. Move file back to: `src/app/api/admin/anki/cards/[id]/route.ts`

2. Uncomment the imports:
   ```typescript
   import { getAnkiCardByNoteId, getAnkiCardByGuid } from "@/features/anki/services/anki-loader";
   ```

3. Uncomment the function calls in the GET handler

4. Update client code to fetch cards via API:
   ```typescript
   // Before (current - direct R2)
   const ankoma = await loadClientAnkoma(); // Loads full dataset
   const card = ankoma.cards[index];

   // After (API route)
   const response = await fetch(`/api/admin/anki/cards/${cardId}`);
   const { card } = await response.json();
   ```

5. Consider adding:
   - Authentication/authorization middleware
   - Rate limiting
   - Response caching headers
   - Error handling for missing cards

## Implementation Notes

**Card ID Types:**
- `noteId` (number) - Numeric Anki note ID
- `guid` (string) - Standard Anki GUID identifier

**Data Structure:**
The `ankoma.json` file contains:
- Deck hierarchy
- Note models (card templates)
- Cards with fields (front, back, cloze content)
- Media file references
- CSS styling

**Server-Side Loading:**
The `anki-loader.ts` service can load and parse ankoma.json server-side, providing functions like:
- `getAnkiCardByNoteId(noteId: number)`
- `getAnkiCardByGuid(guid: string)`
- `loadAnkomaData()` - Loads full dataset with 5-minute cache

## Reference

- Created: circa October 2024
- Moved to WIP: January 2025
- Current Anki viewer: `src/app/(dashboard)/dashboard/anki/page.tsx`
- Client hook: `src/shared/hooks/use-client-ankoma.ts`
- Anki services: `src/features/anki/services/anki-loader.ts`
- Dataset: `https://pub-{id}.r2.dev/anki/ankoma.json` (public)
