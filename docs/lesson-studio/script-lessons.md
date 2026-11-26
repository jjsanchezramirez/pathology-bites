# The script format

A script is a lesson written as narration, one sentence at a time. It's how a
lesson comes into Lesson Studio from outside: **File → Import script…** (JSON or
plain text), and the AI generator writes the same JSON. Each scene becomes an
editable canvas slide built from one of five templates; each sentence becomes a
narration line, and the items it reveals appear when it's spoken. See
[README.md](./README.md) for the whole workflow.

## The rules that keep it simple

- **Script first.** Write the narration one sentence at a time. Add on-screen
  words to a sentence only when something should appear with it.
- **Five templates.** Title, image with callouts, side by side, step ladder,
  take-home.
- **Timing from the voice.** Before narration, timing is estimated from word
  count (about 155 words a minute, with the same pauses the narration uses).
  After narration, each sentence starts exactly when it is spoken.

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

## Older rows

The retired script studio saved this format directly in
`interactive_sequences.sequence_data` (marked `"format": "script-lesson"`).
Those rows are converted to canvas lessons when read, with any narration kept.
