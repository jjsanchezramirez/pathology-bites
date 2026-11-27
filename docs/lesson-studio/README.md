# Lesson Studio

Lesson Studio (`/admin/lesson-studio`, admins only) builds short narrated
lessons: slides of pictures, labels and pointers that appear as the narrator
says each sentence. There is one editor, the canvas editor, and one stored
format, the canvas `Lesson` (`src/shared/lesson/types.ts`).

## The workflow

1. **Start.** Any of:
   - **Generate** (top right): a topic, optional notes, a length and up to eight
     library pictures. Each picture goes through vision first, then the AI writes
     a script of template scenes that point at real features. See
     [Generating](#generating).
   - **File → Import script…**: paste a script (JSON or plain text, see
     [script-lessons.md](./script-lessons.md)).
   - **+** at the end of the filmstrip: add template scenes by hand, or a blank
     slide for free placement.
2. **Edit.** Every element is an ordinary canvas element. Template elements are
   tied to a narration sentence and time themselves from it; see
   [templates-in-canvas.md](./templates-in-canvas.md).
3. **Narrate.** File → Narrate with Gemini. Each sentence is spoken separately
   and laid end to end, so every sentence's start and end are exact; slides and
   elements retime to the voice. The track is saved to the audio library as MP3.
4. **Save** as Draft or Published (File → Save).
5. **Embed** (File → Embed…). Only published lessons play outside the studio.

## Embedding

A published lesson can go anywhere:

| Where                              | How                                                                                     |
| ---------------------------------- | --------------------------------------------------------------------------------------- |
| Learning Modules                   | `:::explainer[<lesson id>]` on its own line (or the module editor's lesson picker)      |
| Question teaching points and stems | the same line, on its own (option explanations are inline text, so they can't hold one) |
| Other pages in the app             | `<LessonEmbed lessonId=… />` (`src/shared/components/explainer/lesson-embed.tsx`)       |
| Other websites                     | the iframe from File → Embed…, which frames `/embed/lessons/<id>`                       |

All of them read `GET /api/public/lessons/<id>`, which needs no sign-in and only
serves published rows (the CDN may keep a copy for up to five minutes).
`/embed/*` is the only path any site may frame (`frame-ancestors *` in
`next.config.ts`); everything else stays `X-Frame-Options: DENY`.

Code: `src/shared/lesson/embed.ts` (the line syntax, paths, iframe snippet).

## Generating

`POST /api/admin/lesson-studio/generate-lesson` (`generate-lesson/`):

1. Picture details come from the `images` table (title, category, magnification).
2. `vision.ts`: every picture through the vision fallback chain in parallel
   (`lesson-vision` profile). The model finds the key feature; the pointer type
   comes from a fixed decision table (magnification × shape × size).
3. `writer.ts`: one call (`lesson-writer` profile) writes the script as JSON.
   Picture numbers are bound to the real images, regions are clamped, an image
   scene with no pointer gets the one vision found, and a scene that names a
   picture that wasn't provided becomes a list. The result goes through the same
   importer as File → Import script, so a bad answer fails over to the next model.

The client turns the script into canvas scenes (`lessonFromScript`) as a new,
unsaved lesson. Notes from step 3 are shown in the dialog.

## Narration

`narration/generate` speaks one **part**: a few whole slides, at most
`maxLinesPerRequest` sentences (reported by `narration/voices`; about 45 at
Gemini's 10 requests a minute, within the route's 300 s). The part waits in R2
under `narration-parts/<run id>/`. When every part is done, `narration/finish`
joins them, encodes a 48 kb/s MP3, refines word times with Whisper if asked and
configured, records the track in `audio`, and deletes the parts. Slide cues are
slide-relative, so only word times move when parts are joined
(`joinNarrationParts`). Parts from a run that never finished (a closed tab, a failed
request) are deleted by an R2 lifecycle rule on the `pathology-bites-audio`
bucket, "Expire narration parts after 1 day" (prefix `narration-parts/`), so
nothing in the code has to clean up after failures.

Code: `src/shared/lesson/narration.ts` (pure: assembly, batching, joining,
retiming), `src/shared/services/gemini-tts.ts`, `src/shared/services/mp3.ts`.

## Storage

`interactive_sequences.sequence_data` holds the Lesson JSON; `status` is
`draft` or `published`. RLS: anonymous visitors read published rows only, signed-in users read published rows, admins read and write everything ([migration](./migrations/20261126120000_interactive_sequences_rls.sql), tested by `supabase/tests/interactive-sequences-rls/run.sh`). Rows saved by the
retired script studio (`format: "script-lesson"`) are converted to canvas when
read (`normalizeStoredSequence`), narration included, and saving one writes the
canvas version back to the same row.
