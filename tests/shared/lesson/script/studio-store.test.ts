import { describe, it, expect, beforeEach } from "vitest";
import { useScriptStudio, selectIsDirty } from "@/app/(admin)/admin/lesson-studio/script/store";
import { emptyScriptLesson } from "@/shared/lesson/script/types";

describe("script studio store", () => {
  beforeEach(() => useScriptStudio.getState().setLesson(emptyScriptLesson()));

  it("coalesces typing in one field into a single undo step", () => {
    const s = useScriptStudio.getState();
    const scene = s.lesson.scenes[0];
    const beat = scene.beats[0];
    s.updateBeat(scene.id, beat.id, { say: "H" }, `say:${beat.id}`);
    s.updateBeat(scene.id, beat.id, { say: "Hi" }, `say:${beat.id}`);
    expect(useScriptStudio.getState().past.length).toBe(1);
    expect(selectIsDirty(useScriptStudio.getState())).toBe(true);
    useScriptStudio.getState().undo();
    expect(useScriptStudio.getState().lesson.scenes[0].beats[0].say).toBe("");
    expect(selectIsDirty(useScriptStudio.getState())).toBe(false);
    useScriptStudio.getState().redo();
    expect(useScriptStudio.getState().lesson.scenes[0].beats[0].say).toBe("Hi");
  });

  it("adds, moves and removes scenes and sentences, never below one", () => {
    const s = useScriptStudio.getState();
    s.addScene("ladder");
    const [a, b] = useScriptStudio.getState().lesson.scenes;
    expect(b.template).toBe("ladder");
    useScriptStudio.getState().moveScene(b.id, -1);
    expect(useScriptStudio.getState().lesson.scenes[0].id).toBe(b.id);
    useScriptStudio.getState().removeScene(a.id);
    useScriptStudio.getState().removeScene(b.id);
    expect(useScriptStudio.getState().lesson.scenes.length).toBe(1);
    const only = useScriptStudio.getState().lesson.scenes[0];
    useScriptStudio.getState().removeBeat(only.id, only.beats[0].id);
    expect(useScriptStudio.getState().lesson.scenes[0].beats.length).toBe(1);
  });

  it("clears a field without leaving an undefined key", () => {
    const s = useScriptStudio.getState();
    const scene = s.lesson.scenes[0];
    const beat = scene.beats[0];
    s.updateBeat(scene.id, beat.id, { text: "x" });
    useScriptStudio.getState().updateBeat(scene.id, beat.id, { text: undefined });
    expect("text" in useScriptStudio.getState().lesson.scenes[0].beats[0]).toBe(false);
  });
});
