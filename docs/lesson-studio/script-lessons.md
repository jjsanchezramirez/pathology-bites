# Script lessons

The script studio (`/admin/lesson-studio/script`) builds lessons script first. A lesson is a
list of scenes. Each scene uses one of five templates, and each sentence of
narration is one beat: when the narrator says it, its item appears.

The canvas editor at `/admin/lesson-studio` now offers the same templates as
editable scenes; see [templates-in-canvas.md](./templates-in-canvas.md). Canvas
lessons keep playing exactly as before.

## The rules that keep it simple

- **Script first.** Write the narration one sentence at a time. Add on-screen
  words to a sentence only when something should appear with it.
- **Five templates.** Title, image with callouts, side by side, step ladder,
  take-home. No free placement.
- **Timing from the voice.** Before narration, timing is estimated from word
  count (about 155 words a minute, with the same pauses the narration uses).
  After narration, each sentence starts exactly when it is spoken. Nothing is
  keyframed by hand.
- **Fixed motion.** One easing curve (ease in-out cubic), one fade (0.6 s with a
  small rise), one zoom (1.1 s, at most 3×), and a 0.5 s crossfade between scenes.
- **One look.** Instrument Sans, warm white background, dark ink, the brand teal
  as the only accent, and a yellow mark on pictures.

## Templates

| Template   | What each sentence does                                                                                                                                                                                     |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`    | The heading is the big title. A sentence with `text` adds a subtitle.                                                                                                                                       |
| `image`    | A sentence with a `region` rings or spotlights that part of the picture, or zooms into it (`mark`). `text` adds a numbered label beside the picture; a sentence with `text` and no region adds a bold note. |
| `compare`  | Sentences with `side: "left"` fill the left panel, `"right"` the right one. The first sentence on a side is its title. A sentence with `text` and no side is a closing line under both.                     |
| `ladder`   | Each sentence with `text` adds the next rung; `detail` is the smaller line. The rung being spoken is highlighted.                                                                                           |
| `takehome` | Each sentence with `text` adds a point.                                                                                                                                                                     |

A sentence with no `text` is narration only: it is spoken and keeps the timing,
but adds nothing on screen.

## JSON format

```json
{
  "format": "script-lesson",
  "version": 1,
  "title": "Barrett esophagus",
  "description": "…",
  "scenes": [
    {
      "template": "ladder",
      "heading": "The dysplasia ladder",
      "beats": [
        "Then grade it on a ladder.",
        {
          "say": "Negative: the atypia matures toward the surface.",
          "text": "Negative",
          "detail": "Atypia matures toward the surface"
        }
      ]
    },
    {
      "template": "image",
      "heading": "Four lines",
      "image": {
        "url": "https://img.pathologybites.com/library/….jpg",
        "width": 487,
        "height": 329
      },
      "credit": "Figure: …",
      "beats": [
        {
          "say": "Line one is the mucin droplet.",
          "text": "Mucin droplet",
          "region": { "x": 46, "y": 7, "w": 10, "h": 7 },
          "mark": "ring"
        }
      ]
    }
  ]
}
```

- A beat can be just its sentence (a string).
- `id`s are optional on import and are generated.
- `image` can be a URL string or `{ url, alt?, width?, height? }`.
- `region` is in percent of the picture: `x`, `y` is the top-left corner.
- `mark` is `ring` (default), `spotlight` or `zoom`.
- **Export** in the studio writes this same format, without ids, timings or audio.

## Plain-text format

```
# title: Barrett esophagus
Barrett esophagus: how to make the diagnosis, and how to grade dysplasia. | Diagnosis and dysplasia grading

# ladder: The dysplasia ladder
Then grade it on a ladder.
Negative: the atypia matures toward the surface. | Negative | Atypia matures toward the surface
```

A line starting with `#` starts a scene (`# template: Heading`). Every other line
is one sentence: `Sentence | on-screen words | smaller line`. A line without a
bar is split into sentences.

## Storage

Script lessons are saved in `interactive_sequences.sequence_data` like canvas
lessons, marked with `"format": "script-lesson"`. No schema change. The player
picks the right renderer from that marker.

## Video export

**Export → Video (MP4)** renders the lesson frame by frame in the browser and
adds the narration audio. It draws the same five templates and motion as the
player (`src/shared/lesson/script/draw.ts`), in Instrument Sans. Captions can be
burned in; they're on by default when the lesson has no narration yet.
