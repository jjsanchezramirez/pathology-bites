import { describe, it, expect, beforeEach } from "vitest";
import { useEditorStore } from "@/app/(admin)/admin/lesson-studio/model/store";
import type { Slide, ShapeElement } from "@/app/(admin)/admin/lesson-studio/model/types";
import {
  emptyLesson,
  DEFAULT_FRAMING,
  DEFAULT_TRANSITION,
  timing,
} from "@/app/(admin)/admin/lesson-studio/model/types";

function makeSlide(id: string): Slide {
  return {
    id,
    duration: 5,
    transitionIn: { ...DEFAULT_TRANSITION },
    initialFraming: { ...DEFAULT_FRAMING },
    elements: [],
  };
}

function makeShape(id: string): ShapeElement {
  return {
    id,
    kind: "shape",
    shape: "circle",
    rect: { x: 40, y: 40, w: 20, h: 20, rotation: 0 },
    stroke: { color: "#f00", width: 2, style: "solid" },
    timing: timing(0, 0.5, 2, 0.5),
  };
}

beforeEach(() => {
  useEditorStore.setState({
    lesson: emptyLesson(),
    selection: { slideId: null, elementIds: [] },
    viewTime: 0,
    mode: "edit",
    tool: "select",
    history: { past: [], future: [] },
    dragSnapshot: null,
  });
});

describe("editor store — slides", () => {
  it("adds slides and auto-selects", () => {
    useEditorStore.getState().addSlide(makeSlide("a"));
    expect(useEditorStore.getState().lesson.slides).toHaveLength(1);
    expect(useEditorStore.getState().selection.slideId).toBe("a");
  });

  it("reorders slides by id list", () => {
    const s = useEditorStore.getState();
    s.addSlide(makeSlide("a"));
    s.addSlide(makeSlide("b"));
    s.addSlide(makeSlide("c"));
    s.reorderSlides(["c", "a", "b"]);
    expect(useEditorStore.getState().lesson.slides.map((x) => x.id)).toEqual(["c", "a", "b"]);
  });

  it("removes slides and resets selection", () => {
    const s = useEditorStore.getState();
    s.addSlide(makeSlide("a"));
    s.addSlide(makeSlide("b"));
    s.selectSlide("a");
    s.removeSlide("a");
    expect(useEditorStore.getState().lesson.slides).toHaveLength(1);
    expect(useEditorStore.getState().selection.slideId).toBe("b");
  });
});

describe("editor store — elements", () => {
  it("adds elements to a slide and selects them", () => {
    const s = useEditorStore.getState();
    s.addSlide(makeSlide("a"));
    s.addElement("a", makeShape("e1"));
    const slide = useEditorStore.getState().lesson.slides[0];
    expect(slide.elements).toHaveLength(1);
    expect(useEditorStore.getState().selection.elementIds).toEqual(["e1"]);
  });

  it("updates elements", () => {
    const s = useEditorStore.getState();
    s.addSlide(makeSlide("a"));
    s.addElement("a", makeShape("e1"));
    s.updateElement("a", "e1", {
      rect: { x: 10, y: 10, w: 10, h: 10, rotation: 45 },
    } as Partial<ShapeElement>);
    const el = useEditorStore.getState().lesson.slides[0].elements[0];
    expect(el.kind === "shape" && el.rect.x).toBe(10);
    expect(el.kind === "shape" && el.rect.rotation).toBe(45);
  });

  it("removes elements and drops them from selection", () => {
    const s = useEditorStore.getState();
    s.addSlide(makeSlide("a"));
    s.addElement("a", makeShape("e1"));
    s.removeElement("a", "e1");
    expect(useEditorStore.getState().lesson.slides[0].elements).toHaveLength(0);
    expect(useEditorStore.getState().selection.elementIds).not.toContain("e1");
  });
});

describe("editor store — undo/redo", () => {
  it("undo reverts add, redo reapplies it", () => {
    const s = useEditorStore.getState();
    s.addSlide(makeSlide("a"));
    expect(useEditorStore.getState().lesson.slides).toHaveLength(1);
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().lesson.slides).toHaveLength(0);
    useEditorStore.getState().redo();
    expect(useEditorStore.getState().lesson.slides).toHaveLength(1);
  });

  it("undo is a no-op with empty history", () => {
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().lesson.slides).toHaveLength(0);
  });

  it("stops redo after a new mutation", () => {
    const s = useEditorStore.getState();
    s.addSlide(makeSlide("a"));
    s.addSlide(makeSlide("b"));
    useEditorStore.getState().undo();
    useEditorStore.getState().addSlide(makeSlide("c"));
    useEditorStore.getState().redo(); // should do nothing; future was cleared
    expect(useEditorStore.getState().lesson.slides.map((x) => x.id)).toEqual(["a", "c"]);
  });
});

describe("editor store — drag coalescing", () => {
  it("rapid updates in a drag session push a single history entry", () => {
    const s = useEditorStore.getState();
    s.addSlide(makeSlide("a"));
    s.addElement("a", makeShape("e1"));
    const historyBefore = useEditorStore.getState().history.past.length;

    s.beginDrag();
    // Simulate 10 drag updates.
    for (let i = 0; i < 10; i++) {
      useEditorStore.getState().updateElement("a", "e1", {
        rect: { x: i, y: i, w: 20, h: 20, rotation: 0 },
      } as Partial<ShapeElement>);
    }
    s.endDrag();

    const historyAfter = useEditorStore.getState().history.past.length;
    expect(historyAfter - historyBefore).toBe(1);
  });

  it("a drag with no net change pushes nothing", () => {
    const s = useEditorStore.getState();
    s.addSlide(makeSlide("a"));
    const historyBefore = useEditorStore.getState().history.past.length;
    s.beginDrag();
    s.endDrag();
    expect(useEditorStore.getState().history.past.length).toBe(historyBefore);
  });
});
