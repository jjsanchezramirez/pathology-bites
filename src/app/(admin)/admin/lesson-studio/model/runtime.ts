// Re-export shim. The editor runtime and the player engine were unified into a
// single pure evaluator at src/shared/lesson/evaluate.ts. Existing relative
// imports (`../model/runtime`) continue to work through this file.

export * from "@/shared/lesson/evaluate";
