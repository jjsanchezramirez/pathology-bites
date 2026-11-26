/**
 * Ask Dr. Albright — the per-answer cost ceiling. Pure, so it is unit-testable.
 *
 * Launch criterion (Nov 2026): no answer may cost more than $0.002 (0.20¢).
 * (First set at 0.10¢; raised the same day — at 0.10¢ answers saw ~40% of the
 * source text they used to, and the eval lost cases to trimmed passages.)
 * Enforced up front, not measured after: before each model call the budget
 * reserves the call's WORST case — its prompt plus its full output cap — and
 * the caller shrinks the prompt (fewer, shorter passages) until it fits. What
 * the call then actually spends is recorded from its usage (Workers AI reports
 * `neurons`, its billing unit, so the recorded cost is exact).
 *
 * Prices: developers.cloudflare.com/workers-ai/platform/pricing (Nov 2026).
 */

export const COST_CAP_USD = 0.002;

/** The reranker's price key (rerank.ts calls it outside the openai-compat caller). */
export const RERANK_COST_MODEL = "@cf/baai/bge-reranker-base";

/** Workers AI bills neurons at $0.011 per 1,000. */
const USD_PER_NEURON = 0.011 / 1000;

interface Price {
  /** USD per input token. */
  in: number;
  /** USD per output token. */
  out: number;
}

const PER_M = 1e-6;
const PRICES: Record<string, Price> = {
  "@cf/mistralai/mistral-small-3.1-24b-instruct": { in: 0.351 * PER_M, out: 0.555 * PER_M },
  "@cf/openai/gpt-oss-120b": { in: 0.35 * PER_M, out: 0.75 * PER_M },
  "@cf/openai/gpt-oss-20b": { in: 0.2 * PER_M, out: 0.3 * PER_M },
  "@cf/baai/bge-reranker-base": { in: 0.0031 * PER_M, out: 0 },
};

export interface Usage {
  prompt_tokens?: number;
  completion_tokens?: number;
  neurons?: number;
}

/**
 * Prompt tokens, conservatively estimated. Measured on mistral-small (Nov
 * 2026): 3.9 chars a token on pathology prose, 3.45 on code-dense text. Digits
 * and non-ASCII (β, ±, ::, –) tokenize densely — an answer whose prompt was
 * full of EWSR1::FLI1 and IHC symbols came in over a 3.4-chars estimate and
 * came in over its estimate (it cost $0.001007 against a $0.001 cap) — so each digit and non-ASCII character counts as a token of
 * its own on top. A low guess is what could break the ceiling.
 */
const CHARS_PER_TOKEN = 3.4;

export function estimateTokens(text: string): number {
  const dense = text.match(/[0-9]|[^\x00-\x7f]/g)?.length ?? 0;
  return Math.ceil((text.length - dense) / CHARS_PER_TOKEN + dense);
}

function price(model: string): Price {
  const p = PRICES[model];
  if (!p) throw new Error(`No price for ${model}: add it to PRICES before calling it`);
  return p;
}

/** What a finished call cost: from neurons when reported, else from tokens. */
export function costOf(model: string, usage: Usage | undefined): number {
  if (!usage) return 0;
  if (typeof usage.neurons === "number" && usage.neurons > 0) return usage.neurons * USD_PER_NEURON;
  const p = price(model);
  return (usage.prompt_tokens ?? 0) * p.in + (usage.completion_tokens ?? 0) * p.out;
}

/** The most a call can cost: its prompt plus every output token it may write. */
export function worstCase(model: string, promptTokens: number, maxOutput: number): number {
  const p = price(model);
  return promptTokens * p.in + maxOutput * p.out;
}

/**
 * Prompt tokens a call may use and still fit what is left of the budget,
 * after reserving its full output cap. Negative means the output cap alone
 * does not fit.
 */
export function promptRoom(model: string, remainingUsd: number, maxOutput: number): number {
  const p = price(model);
  return Math.floor((remainingUsd - maxOutput * p.out) / p.in);
}

/** Running spend for one answer against the ceiling. */
export class CostBudget {
  private spentUsd = 0;
  /** Spend promised to calls still in flight (released when they record). */
  private heldUsd = 0;

  constructor(readonly capUsd: number = COST_CAP_USD) {}

  get spent(): number {
    return this.spentUsd;
  }

  /** What is left for new calls. */
  get remaining(): number {
    return this.capUsd - this.spentUsd - this.heldUsd;
  }

  /** Reserve a call's worst case; false (and nothing held) when it does not fit. */
  hold(usd: number): boolean {
    if (usd > this.remaining + 1e-12) return false;
    this.heldUsd += usd;
    return true;
  }

  /** A held call finished: release its hold and record what it really cost. */
  settle(heldUsd: number, actualUsd: number): void {
    this.heldUsd = Math.max(0, this.heldUsd - heldUsd);
    this.spentUsd += actualUsd;
  }
}
