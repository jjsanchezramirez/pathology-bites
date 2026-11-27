# Templates in the canvas editor

Lesson Studio (`/admin/lesson-studio`) is the canvas editor: library on the
left, canvas in the middle, inspector on the right, timeline and filmstrip
below. Scene templates live inside it. See [README.md](./README.md) for the
whole workflow.

## Add scene

The **+** at the end of the filmstrip offers the five templates (title, image
with callouts, side by side, step ladder, take-home) and a blank slide. A
template drops in ordinary elements: text, shapes, pictures, spotlights and
camera moves. Move, restyle or delete any of them. On an image scene, drag a
library picture onto the grey slot (or onto an existing picture) to swap it.

**File → Import script…** turns a whole script (JSON or plain text, see
[script-lessons.md](./script-lessons.md)) into template scenes. **Generate**
drafts one with AI.

## Narration sets the timing

Each slide's narration is one block per sentence on the timeline's top row.
Every template element is tied to a sentence with a **cue**:

- **Auto: appear and stay** (`cue: "build"`): fades in as its sentence starts
  and stays to the end of the slide. With no sentence, it's there the whole
  slide.
- **Auto: only during its sentence** (`cue: "beat"`): fades in with its
  sentence and leaves when the next one starts (rings, spotlights, zooms, the
  highlighted step).

Template slides also take their length from the narration
(`slide.autoDuration`). Before the voice exists, sentence lengths are
estimated from word count; drag a sentence block to move it (its elements
follow, and so do the sentences after it), double-click to put it back. Once
the voice is recorded, its times win and the blocks lock.

Dragging an element's bar, or typing a time in the inspector, switches that
element to manual timing. The inspector's Narration section switches it back
or ties it to another sentence. Auto bars have a dashed edge and say "auto".

Code: `src/shared/lesson/auto-timing.ts` (pure; the editor store runs it after
every change).

## The clean look

Template slides set `look: "clean"`: elements draw strictly in list order inside
the camera, text sits in its box (Instrument Sans, no shadows), and every
entrance is the same fade with a small rise on one easing curve. Camera moves
use the same curve. A spotlight on a template slide can be limited to the
picture (`within`). Slides without `look` render exactly as before, so older
lessons play unchanged.

Code: `src/shared/lesson/clean.ts` (drawing items),
`src/shared/components/explainer/clean-layer.tsx` (player and editor),
`src/shared/lesson/templates.ts` (scene → slide).

## Everything fits

A template never lets text overflow or run off the frame:

- **Headings** shrink to stay on at most two lines above the content.
- **Crowded scenes** (long labels, six rungs, five long points) are rebuilt with their text scaled
  down, step by step to 60%, until the content's lowest edge is inside the frame
  (`fitScene` in `src/shared/lesson/templates.ts`).
- **On screen**, each text is held to its box and shrinks (down to half size) if it still doesn't
  fit, so an estimate that comes out short costs a little size, never an overlap
  (`clean-layer.tsx`, search in `src/shared/lesson/fit.ts`). Editing a template text in the editor
  behaves the same way: make the box bigger to make the text bigger.

The player's controls hide while a lesson plays, so nothing at the bottom of a slide is covered.

## Known limits

- Zooms move the whole frame (classic camera), not just the picture, so
  callouts beside the picture leave the frame while zoomed.
