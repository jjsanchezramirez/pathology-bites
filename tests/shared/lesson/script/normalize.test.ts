import { describe, it, expect } from "vitest";
import { isStoredSequenceShape, normalizeStoredSequence } from "@/shared/lesson/normalize";
import { emptyScriptLesson } from "@/shared/lesson/script/types";
import { emptyLesson } from "@/shared/lesson/types";
import { retryDelaySeconds } from "@/shared/services/gemini-tts";

describe("stored sequences", () => {
  it("accepts script lessons as they are and canvas lessons as before", () => {
    const s = emptyScriptLesson();
    expect(isStoredSequenceShape(s)).toBe(true);
    expect(normalizeStoredSequence(s)).toBe(s);
    const c = emptyLesson();
    expect(isStoredSequenceShape(c)).toBe(true);
    expect(normalizeStoredSequence(c)).not.toBeNull();
    expect(isStoredSequenceShape({ foo: 1 })).toBe(false);
  });
});

describe("Gemini retry delay", () => {
  it("reads the delay Gemini asks for", () => {
    expect(retryDelaySeconds('"retryDelay": "23s"')).toBe(23);
    expect(retryDelaySeconds("Please retry in 7.5s.")).toBe(7.5);
    expect(retryDelaySeconds("quota exceeded")).toBeNull();
  });
});
