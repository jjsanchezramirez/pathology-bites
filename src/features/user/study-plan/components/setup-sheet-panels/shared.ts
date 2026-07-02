import type { estimatePhaseHours } from "../../lib/scheduler";

export type PhaseEstimate = ReturnType<typeof estimatePhaseHours>[number];
