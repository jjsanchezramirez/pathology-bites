/**
 * OfflineQueueManager must keep the answers Map through its localStorage
 * round-trip. JSON.stringify turns a Map into {}, so a queued progress save
 * used to replay with zero answers.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { OfflineQueueManager } from "@/features/user/quiz/services/offline-queue-manager";

describe("OfflineQueueManager answers round-trip", () => {
  let manager: OfflineQueueManager;

  beforeEach(() => {
    localStorage.clear();
    manager = new OfflineQueueManager();
  });

  afterEach(() => {
    manager.clearQueue();
    localStorage.clear();
  });

  it("restores queued answers as a Map with every entry", () => {
    const answers = new Map([
      ["q1", { selectedOptionId: "a", isCorrect: true, timestamp: 1, timeSpent: 10 }],
      ["q2", { selectedOptionId: "b", isCorrect: false, timestamp: 2, timeSpent: 12 }],
    ]);

    manager.addToQueue("session-1", { sessionId: "session-1", answers }, "periodic");

    const [item] = manager.getQueue();
    const restored = (item.data as { answers: Map<string, unknown> }).answers;
    expect(restored).toBeInstanceOf(Map);
    expect(restored.size).toBe(2);
    expect(restored.get("q2")).toMatchObject({ selectedOptionId: "b" });
  });
});
