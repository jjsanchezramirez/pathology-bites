import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("@/shared/components/explainer/lesson-embed", () => ({
  LessonEmbed: ({ lessonId }: { lessonId: string }) => <div data-testid="lesson">{lessonId}</div>,
}));

import { QuestionMarkdown } from "@/shared/components/common/question-markdown";

const ID = "7106e5c4-e3f8-4c67-aa34-f8da84b9e3c4";

describe("QuestionMarkdown lesson embeds", () => {
  it("embeds a lesson from a line of its own", () => {
    const { getByTestId, getByText } = render(
      <QuestionMarkdown>{`Goblet cells are required.\n\n:::explainer[${ID}]\n\nThen grade dysplasia.`}</QuestionMarkdown>
    );
    expect(getByTestId("lesson").textContent).toBe(ID);
    expect(getByText("Goblet cells are required.")).toBeTruthy();
  });

  it("leaves colons in ordinary text alone", () => {
    const { queryByTestId, getByText } = render(
      <QuestionMarkdown>{"CD4:CD8 ratio is 2:1 here."}</QuestionMarkdown>
    );
    expect(queryByTestId("lesson")).toBeNull();
    expect(getByText("CD4:CD8 ratio is 2:1 here.")).toBeTruthy();
  });

  it("doesn't embed in inline mode", () => {
    const { queryByTestId } = render(
      <QuestionMarkdown inline>{`:::explainer[${ID}]`}</QuestionMarkdown>
    );
    expect(queryByTestId("lesson")).toBeNull();
  });
});
