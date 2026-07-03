// Pure calculators behind /api/user/performance-data. Each module takes
// already-fetched rows and returns a slice of the unified response — no I/O.

export * from "./types";
export * from "./build-summary";
export * from "./calculate-category-stats";
export * from "./calculate-timeline";
export * from "./calculate-heatmap";
export * from "./calculate-achievements";
export * from "./build-recent-activity";
export * from "./build-quiz-init";
