/**
 * Renders a short attributed excerpt of a WHO section, never the section.
 *
 * The chapter text is subscription content and stays in the database. What the
 * RPC hands back per source is the first sentence (<= 240 chars) plus enough
 * bibliography to send the reader to the publisher: the volume, edition, year,
 * the section heading and a chapter URL. This component shows exactly that and
 * nothing more — there is no prop that could make it print a body.
 *
 * The excerpt is stored as published, inline markers and all:
 *
 *   "SPNs always show nuclear expression of β-catenin {10881741; 11731417}."
 *   "…follows the protocol for carcinomas [[Amin MB, Edge S, …]]."
 *
 * Those markers are the provenance. Stripping them would throw away the only
 * thing that makes a sentence checkable, and leaving them raw makes it
 * unreadable — so they are parsed out and re-rendered as superscript links.
 */
import type { Excerpt } from "@/features/public/knowledge/lib/queries";

/** {12345678; 23456789} or [[Author. Title. Publisher; 2017.]] */
// [\s\S] rather than `.` with the /s flag: a book reference can span lines and
// this tsconfig targets below es2018, where dotAll is not available.
const MARKER = /\{([0-9][0-9;\s]*)\}|\[\[([\s\S]+?)\]\]/g;

/**
 * The same text with every citation marker removed, for places that need a
 * plain string rather than nodes — the SEO meta description and the page lede.
 * Never use this where the citation matters; it is a summary, not the evidence.
 */
export function plainText(body: string): string {
  return body.replace(MARKER, "").replace(/\s+/g, " ").trim();
}

export function PubMedLink({ id, className }: { id: string; className?: string }) {
  return (
    <a
      href={`https://pubmed.ncbi.nlm.nih.gov/${id}/`}
      target="_blank"
      rel="noopener noreferrer"
      title={`PubMed ${id}`}
      className={className ?? "text-primary/70 hover:text-primary hover:underline"}
    >
      {id}
    </a>
  );
}

/** Text with its inline `{pmid}` and `[[book]]` markers rendered as superscripts. */
export function ProseText({ body }: { body: string }) {
  const out: React.ReactNode[] = [];
  let last = 0;
  let key = 0;

  for (const m of body.matchAll(MARKER)) {
    const at = m.index ?? 0;
    if (at > last) out.push(body.slice(last, at));
    last = at + m[0].length;

    if (m[1] !== undefined) {
      const ids = m[1]
        .split(";")
        .map((s) => s.trim())
        .filter((s) => /^[0-9]{1,9}$/.test(s));
      out.push(
        <sup key={`c${key++}`} className="ml-0.5 whitespace-nowrap text-[10px]">
          {ids.map((id, i) => (
            <span key={id}>
              {i > 0 && <span className="text-muted-foreground">,&nbsp;</span>}
              <PubMedLink id={id} />
            </span>
          ))}
        </sup>
      );
    } else {
      // A book reference. The full citation is long, so it becomes a hover
      // title rather than inline text that would swamp the sentence.
      out.push(
        <sup
          key={`c${key++}`}
          title={m[2]}
          className="ml-0.5 cursor-help text-[10px] text-muted-foreground underline decoration-dotted"
        >
          book
        </sup>
      );
    }
  }
  if (last < body.length) out.push(body.slice(last));

  return <>{out}</>;
}

/**
 * One source document's excerpt for one axis: the sentence, then who printed
 * it and where the rest of the section lives.
 *
 * `heading` is the publisher's own wording, kept because it is not always the
 * axis label — "Clinical features and imaging" maps onto the clinical axis but
 * is not what the book called it.
 */
export function AttributedExcerpt({ excerpt }: { excerpt: Excerpt }) {
  // The RPC draws excerpts from paragraph and bullet passages only, so table
  // markup never arrives here; and the text is rendered as text regardless, so
  // a sentence that opens with "<" ("< 5% bone marrow blasts") is just prose.
  const behind =
    excerpt.n_passages > 1 || excerpt.n_citations > 0
      ? [
          excerpt.n_passages > 1 ? `${excerpt.n_passages} paragraphs` : null,
          excerpt.n_citations > 0
            ? `${excerpt.n_citations} ${excerpt.n_citations === 1 ? "reference" : "references"}`
            : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : null;

  return (
    <figure className="flex flex-col gap-1.5">
      <blockquote className="border-l-2 border-muted-foreground/30 pl-3 text-[15px] italic leading-relaxed text-foreground/90">
        <ProseText body={excerpt.excerpt} />
      </blockquote>
      <figcaption className="pl-3 text-xs text-muted-foreground">
        <span>
          — WHO Classification of Tumours · {excerpt.authority_name}
          {excerpt.year ? ` (${excerpt.year})` : ""} · {excerpt.heading}
        </span>
        {excerpt.url && (
          <>
            <span aria-hidden="true"> · </span>
            <a
              href={excerpt.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary/80 hover:text-primary hover:underline"
            >
              Read the full section
            </a>
          </>
        )}
        {behind && <span className="ml-1.5 text-muted-foreground/70">({behind} in this section)</span>}
      </figcaption>
    </figure>
  );
}
