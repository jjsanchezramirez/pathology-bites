import { describe, expect, it } from "vitest";
import {
  isHiddenRepository,
  isViewerSupported,
  whoSourceViewerUrl,
} from "@/shared/utils/domain/repository";
import { repositoryLogos } from "@/shared/components/common/repository-logos";

describe("WHO Blue Books slides (subscription-only since Nov 2026)", () => {
  it("are no longer opened in the in-house viewer", () => {
    expect(isViewerSupported("WHO Blue Books Online")).toBe(false);
    expect(isViewerSupported("Leeds University")).toBe(true);
  });

  it("link to WHO's own viewer page, built from the corpus id and the file id", () => {
    // Verified against a live slide: fid 30389 opens at /displayviewerhd/63/177/30389.
    expect(
      whoSourceViewerUrl(
        "who_63_177_60687",
        "https://tumourclassification.iarc.who.int/Viewer/Index2?fid=30389"
      )
    ).toBe("https://tumourclassification.iarc.who.int/displayviewerhd/63/177/30389");
  });

  it("leaves the URL unchanged when the id or fid cannot be parsed", () => {
    const url = "https://tumourclassification.iarc.who.int/Viewer/Index2?fid=30389";
    expect(whoSourceViewerUrl("who_odd", url)).toBe(url);
    const noFid = "https://tumourclassification.iarc.who.int/welcome";
    expect(whoSourceViewerUrl("who_63_177_60687", noFid)).toBe(noFid);
  });
});

describe("hidden repositories (MGH unreachable since Nov 2026)", () => {
  it("hides MGH and Toronto, and nothing else", () => {
    expect(isHiddenRepository("MGH Pathology")).toBe(true);
    expect(isHiddenRepository("University of Toronto LMP")).toBe(true);
    expect(isHiddenRepository("Leeds University")).toBe(false);
    expect(isHiddenRepository(undefined)).toBe(false);
    expect(isHiddenRepository("")).toBe(false);
  });

  it("drops the MGH logo from the logo strips", () => {
    expect(repositoryLogos.some((l) => l.id === "mgh")).toBe(false);
    expect(repositoryLogos.some((l) => l.id === "leeds")).toBe(true);
  });
});
