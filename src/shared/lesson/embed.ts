// Embedding a published lesson anywhere: in Learning Modules, question
// explanations, any page on the site, or another site through an iframe.
//
// One syntax inside markdown (`:::explainer[<lesson id>]` on its own line, the
// same directive Learning Modules already use) and one public page
// (/embed/lessons/<id>) that third-party sites frame. Both read the lesson from
// the public API, which only serves published lessons.

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/** A paragraph that is nothing but a lesson embed. */
export const LESSON_EMBED_LINE = new RegExp(`^:::explainer\\[\\s*(${UUID})\\s*\\]$`, "i");

const UUID_ONLY = new RegExp(`^${UUID}$`, "i");

export function isLessonId(id: string): boolean {
  return UUID_ONLY.test(id);
}

/** Lesson id from a markdown line, or null. */
export function lessonIdFromLine(text: string): string | null {
  const m = LESSON_EMBED_LINE.exec(text.trim());
  return m ? m[1].toLowerCase() : null;
}

/** Public JSON for one published lesson. */
export function lessonApiPath(id: string): string {
  return `/api/public/lessons/${id}`;
}

/** The bare player page other sites put in an iframe. */
export function lessonEmbedPath(id: string): string {
  return `/embed/lessons/${id}`;
}

/** What an author pastes into a Learning Module or a question explanation. */
export function lessonMarkdownSnippet(id: string): string {
  return `:::explainer[${id}]`;
}

/** Responsive 16:9 iframe for other websites. */
export function lessonIframeSnippet(id: string, origin: string, title = "Pathology Bites lesson") {
  const src = `${origin.replace(/\/$/, "")}${lessonEmbedPath(id)}`;
  const safeTitle = title.replace(/[<>"&]/g, "");
  return (
    `<div style="position:relative;width:100%;aspect-ratio:16/9">` +
    `<iframe src="${src}" title="${safeTitle}" style="position:absolute;inset:0;width:100%;height:100%;border:0" ` +
    `allow="autoplay; fullscreen" allowfullscreen loading="lazy"></iframe></div>`
  );
}
