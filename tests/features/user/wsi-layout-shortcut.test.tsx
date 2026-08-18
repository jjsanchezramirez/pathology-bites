/**
 * The F / Escape layout shortcut, and the four things that must not trigger it.
 *
 * A bare unmodified letter bound at the window is easy to get wrong: it can eat
 * a keystroke meant for a text field, shadow Cmd-F (browser find), or fight the
 * dialog for Escape. Each guard gets a case here because each one is a silent,
 * annoying bug rather than a visible failure.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";

import { useWsiLayoutShortcut } from "@/features/user/wsi-questions/utils/use-wsi-layout-shortcut";
import { useWsiLayout, resetWsiLayout } from "@/features/user/wsi-questions/utils/wsi-layout";

function Harness() {
  const layout = useWsiLayout();
  useWsiLayoutShortcut(layout);
  return (
    <div>
      <span data-testid="layout">{layout}</span>
      <input data-testid="field" />
      <div data-testid="editable" contentEditable suppressContentEditableWarning />
    </div>
  );
}

beforeEach(() => {
  window.localStorage.clear();
  resetWsiLayout();
  document.body.innerHTML = "";
});

describe("WSI layout shortcut", () => {
  it("F toggles both ways", () => {
    const { getByTestId } = render(<Harness />);

    fireEvent.keyDown(window, { key: "f" });
    expect(getByTestId("layout").textContent).toBe("fullscreen");

    fireEvent.keyDown(window, { key: "F" });
    expect(getByTestId("layout").textContent).toBe("classic");
  });

  it("Escape leaves full screen but never enters it", () => {
    const { getByTestId } = render(<Harness />);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(getByTestId("layout").textContent).toBe("classic");

    fireEvent.keyDown(window, { key: "f" });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(getByTestId("layout").textContent).toBe("classic");
  });

  it("ignores F typed into a field or a contenteditable", () => {
    const { getByTestId } = render(<Harness />);

    fireEvent.keyDown(getByTestId("field"), { key: "f", bubbles: true });
    expect(getByTestId("layout").textContent).toBe("classic");

    fireEvent.keyDown(getByTestId("editable"), { key: "f", bubbles: true });
    expect(getByTestId("layout").textContent).toBe("classic");
  });

  it("leaves Cmd-F and Ctrl-F to the browser", () => {
    const { getByTestId } = render(<Harness />);

    fireEvent.keyDown(window, { key: "f", metaKey: true });
    fireEvent.keyDown(window, { key: "f", ctrlKey: true });
    expect(getByTestId("layout").textContent).toBe("classic");
  });

  it("yields Escape to an open dialog", () => {
    const { getByTestId } = render(<Harness />);
    fireEvent.keyDown(window, { key: "f" });
    expect(getByTestId("layout").textContent).toBe("fullscreen");

    // Radix marks the open dialog in the DOM; Escape belongs to it while it is up.
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("data-state", "open");
    document.body.appendChild(dialog);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(getByTestId("layout").textContent).toBe("fullscreen");

    dialog.remove();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(getByTestId("layout").textContent).toBe("classic");
  });
});
