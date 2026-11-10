/**
 * R2 public origins. The app now *emits* the custom domains but must still
 * *recognise* the legacy r2.dev URLs stored in old images.url rows and R2
 * manifests — otherwise image deletes stop removing the R2 object
 * (extractR2KeyFromUrl returns null) and anki/cell-quiz paths get re-prefixed.
 */
import { describe, it, expect } from "vitest";
import {
  R2_IMAGES_PUBLIC_URL,
  R2_DATA_PUBLIC_URL,
  R2_AUDIO_PUBLIC_URL,
  isR2PublicUrl,
} from "@/shared/config/r2-public-urls";
import { extractR2KeyFromUrl, getR2PublicUrl } from "@/shared/services/r2-storage";
import { transformAnkiMediaUrl } from "@/shared/utils/r2/r2-url-transformer";

const LEGACY_IMG = "https://pub-a4bec7073d99465f99043c842be6318c.r2.dev";
const LEGACY_DATA = "https://pub-cee35549242c4118a1e03da0d07182d3.r2.dev";
const LEGACY_AUDIO = "https://pub-9b9085c172ac445ca3d87dec27a0518f.r2.dev";

describe("public origins", () => {
  it("emit the custom domains, not r2.dev", () => {
    expect(R2_IMAGES_PUBLIC_URL).toBe("https://img.pathologybites.com");
    expect(R2_DATA_PUBLIC_URL).toBe("https://data.pathologybites.com");
    expect(R2_AUDIO_PUBLIC_URL).toBe("https://audio.pathologybites.com");
  });

  it("getR2PublicUrl never emits an r2.dev URL", () => {
    expect(getR2PublicUrl("library/x.mp3", "pathology-bites-audio")).toBe(
      "https://audio.pathologybites.com/library/x.mp3"
    );
    for (const bucket of [
      "pathology-bites-images",
      "pathology-bites-audio",
      "pathology-bites-videos",
      "pathology-bites-anki",
    ]) {
      expect(getR2PublicUrl("k", bucket)).not.toContain("r2.dev");
    }
  });
});

describe("isR2PublicUrl", () => {
  it.each([
    R2_IMAGES_PUBLIC_URL,
    R2_DATA_PUBLIC_URL,
    R2_AUDIO_PUBLIC_URL,
    LEGACY_IMG,
    LEGACY_DATA,
    LEGACY_AUDIO,
  ])("recognises %s", (origin) => {
    expect(isR2PublicUrl(`${origin}/library/x.jpg`)).toBe(true);
  });

  it("rejects foreign hosts and lookalikes", () => {
    expect(isR2PublicUrl("https://example.com/library/x.jpg")).toBe(false);
    expect(isR2PublicUrl("https://img.pathologybites.com.evil.com/x.jpg")).toBe(false);
    expect(isR2PublicUrl("https://pathologybites.com/x.jpg")).toBe(false);
  });

  it("is false for relative paths and junk", () => {
    expect(isR2PublicUrl("paste-123.jpg")).toBe(false);
    expect(isR2PublicUrl("")).toBe(false);
  });
});

describe("extractR2KeyFromUrl (used by image delete routes)", () => {
  it.each([R2_IMAGES_PUBLIC_URL, LEGACY_IMG])("extracts the key from %s URLs", (origin) => {
    expect(extractR2KeyFromUrl(`${origin}/library/20260101-foo.jpg`)).toBe(
      "library/20260101-foo.jpg"
    );
  });

  it("returns null for a foreign host", () => {
    expect(extractR2KeyFromUrl("https://example.com/library/foo.jpg")).toBeNull();
  });
});

describe("transformAnkiMediaUrl", () => {
  it("prefixes bare anki filenames with the images origin", () => {
    expect(transformAnkiMediaUrl("paste-abc.jpg")).toBe(
      `${R2_IMAGES_PUBLIC_URL}/anki/paste-abc.jpg`
    );
  });

  it.each([R2_IMAGES_PUBLIC_URL, LEGACY_IMG])("leaves %s URLs untouched", (origin) => {
    const url = `${origin}/anki/paste-abc.jpg`;
    expect(transformAnkiMediaUrl(url)).toBe(url);
  });
});
