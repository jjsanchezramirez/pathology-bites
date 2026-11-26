import { describe, expect, it } from "vitest";
import {
  cleanQuote,
  factAnswer,
  factFollowUps,
  isFactRequest,
  pickOne,
  pickedName,
  quoteStandsAlone,
} from "@/features/user/ask-albright/lib/fact";

describe("isFactRequest", () => {
  it.each([
    "Tell me something",
    "tell me something!",
    "Tell me something interesting",
    "Teach me something new",
    "Can you tell me something?",
    "Give me a random fact",
    "tell me a fun pathology fact",
    "Random fact",
    "fun fact please",
    "Surprise me",
    "I'm bored",
    "hey, tell me something",
  ])("matches %j", (q) => expect(isFactRequest(q)).toBe(true));

  it.each([
    "Tell me something about CD30",
    "Tell me something about Hodgkin lymphoma",
    "What is CD30 positive in?",
    "teach me about DLBCL",
    "Is MEF2B positive in Hodgkin lymphoma?",
    "something",
    "tell me",
  ])("leaves %j to the planner", (q) => expect(isFactRequest(q)).toBe(false));
});

describe("fact text", () => {
  it("strips the pick's percentage or qualifier", () => {
    expect(pickedName("Invasive breast carcinoma (100%)")).toBe("Invasive breast carcinoma");
    expect(pickedName("Mesothelioma (variable)")).toBe("Mesothelioma");
    expect(pickedName("Seminoma")).toBe("Seminoma");
  });

  it("drops WHO reference braces", () => {
    expect(cleanQuote("All types express desmin, myogenin, and MYOD1 {16861966}.")).toBe(
      "All types express desmin, myogenin, and MYOD1."
    );
    expect(cleanQuote("Positive for X {1; 2} and Y {3}.")).toBe("Positive for X and Y.");
  });

  it("keeps whole sentences only", () => {
    expect(
      quoteStandsAlone("The tumour cells are immunoreactive for S100, CD57, SOX10, and inhibin.")
    ).toBe(true);
    expect(
      quoteStandsAlone(
        "and a rearrangement involving 10q24 in a soft tissue perineurioma of the foot."
      )
    ).toBe(false);
    expect(quoteStandsAlone("CD30 is positive.")).toBe(false);
    expect(
      quoteStandsAlone("CD38, CD77, and CD43 are also frequently positive in these tumours.")
    ).toBe(false);
    expect(
      quoteStandsAlone("They may be positive for factor XIIIa, fascin, and (less commonly) S100.")
    ).toBe(false);
    expect(
      quoteStandsAlone("The tumour cells are immunoreactive for S100, CD57, SOX10, and inhibin")
    ).toBe(false);
  });

  it("cites the sentence and names the tumour", () => {
    const a = factAnswer(
      "Granular cell tumour",
      "Tumour cells are positive for S100 and SOX10 {123}."
    );
    expect(a).toContain("**Did you know?** In Granular cell tumour:");
    expect(a).toContain("“Tumour cells are positive for S100 and SOX10.” [1]");
    expect(factFollowUps("Glioblastoma: general overview", "GFAP")).toEqual([
      "Which tumours are GFAP positive?",
      "What is the IHC profile of Glioblastoma?",
    ]);
  });

  it("picks uniformly and handles empty lists", () => {
    expect(pickOne(["a", "b", "c"], () => 0.99)).toBe("c");
    expect(pickOne([], () => 0)).toBeUndefined();
  });
});
