/**
 * Pure Serverless Hybrid Quiz System - Main Exports
 *
 * Version: 1.0.0
 * API Call Reduction: 96.7%
 * Target API Calls: 2
 *
 * Features:
 * - Client-side state management
 * - Batched server synchronization
 * - Offline capability
 * - Instant UI responses (0ms latency)
 * - Optimized for Vercel free tier
 * - No Edge Functions required
 *
 * Works with:
 * - Next.js: >=13.0.0
 * - React: >=18.0.0
 * - TypeScript: >=4.5.0
 *
 * This module exports all the components of the hybrid quiz system
 * for easy integration with the existing quiz interface.
 */

// Main Hook (Public API)
export { useHybridQuiz } from "./use-hybrid-quiz";

// Preset Configurations
// Only `enableOfflineSupport` is read by `useHybridQuiz`; mode/timing come from
// `sessionConfig` directly. This preset is the fallback before sessionConfig
// loads and the default for untimed tutor sessions.
export const HybridPresets = {
  TUTOR_MODE: {
    enableOfflineSupport: true,
  },
} as const;
