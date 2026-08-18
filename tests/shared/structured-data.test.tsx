/**
 * JSON-LD emission shape.
 *
 * A single schema must serialise as an object, never as a one-element array.
 * Both are valid JSON-LD, but real consumers (search-preview tools, browser
 * extensions, scrapers) routinely do `JSON.parse(el.textContent)["@context"]`
 * and then call a string method on it. On an array that is `undefined` and they
 * throw — which is exactly what a reader was doing on every page of this site
 * ("undefined is not an object (evaluating 'r[\"@context\"].toLowerCase')").
 */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { StructuredData } from "@/shared/components/seo/structured-data";

function emitted(container: HTMLElement) {
  const el = container.querySelector('script[type="application/ld+json"]');
  return el ? JSON.parse(el.textContent || "null") : null;
}

const ORG = { "@context": "https://schema.org", "@type": "Organization", name: "Pathology Bites" };
const SITE = { "@context": "https://schema.org", "@type": "WebSite", name: "Pathology Bites" };

describe("StructuredData", () => {
  it("emits a single schema as an object, so @context is readable off the parse", () => {
    const { container } = render(<StructuredData data={ORG} />);
    const json = emitted(container);

    expect(Array.isArray(json)).toBe(false);
    expect(json["@context"]).toBe("https://schema.org");
  });

  it("unwraps a one-element array too — that is where the crash came from", () => {
    const { container } = render(<StructuredData data={[ORG]} />);
    const json = emitted(container);

    expect(Array.isArray(json)).toBe(false);
    expect(json["@type"]).toBe("Organization");
  });

  it("keeps an array when there genuinely are several schemas", () => {
    const { container } = render(<StructuredData data={[ORG, SITE]} />);
    const json = emitted(container);

    expect(Array.isArray(json)).toBe(true);
    expect(json).toHaveLength(2);
    // Each item still carries its own @context, as a top-level array requires.
    expect(json.every((s: Record<string, unknown>) => s["@context"])).toBe(true);
  });

  it("renders nothing when there is no usable schema", () => {
    const { container } = render(<StructuredData data={[]} />);
    expect(emitted(container)).toBeNull();
  });
});
