import type { CostRecord, CostSink, TaskKind, TokenUsage } from '../types.js';

/** USD cents per 1M tokens: [input, output]. */
export interface PriceEntry {
  inputPerMillionCents: number;
  outputPerMillionCents: number;
}

/**
 * Pricing table. Update when providers reprice; unknown models use
 * `DEFAULT_PRICE` so cost records are never silently zero.
 */
export const PRICING: Record<string, PriceEntry> = {
  'claude-sonnet-4-6': { inputPerMillionCents: 300, outputPerMillionCents: 1500 },
  'claude-opus-4-8': { inputPerMillionCents: 1500, outputPerMillionCents: 7500 },
  'gpt-4o-mini': { inputPerMillionCents: 15, outputPerMillionCents: 60 },
  'mock-small': { inputPerMillionCents: 0, outputPerMillionCents: 0 },
  'mock-large': { inputPerMillionCents: 0, outputPerMillionCents: 0 },
};

export const DEFAULT_PRICE: PriceEntry = {
  inputPerMillionCents: 300,
  outputPerMillionCents: 1500,
};

export function computeCostCents(model: string, usage: TokenUsage): number {
  const price = PRICING[model] ?? DEFAULT_PRICE;
  const cents =
    (usage.inputTokens * price.inputPerMillionCents +
      usage.outputTokens * price.outputPerMillionCents) /
    1_000_000;
  // Round to 4 decimal places — sub-cent precision matters at MVP volumes.
  return Math.round(cents * 10_000) / 10_000;
}

/** In-memory cost sink — also used as the aggregate store for tests. */
export class InMemoryCostSink implements CostSink {
  readonly records: CostRecord[] = [];

  record(entry: CostRecord): void {
    this.records.push(entry);
  }

  /** Cost rollup by issue → project reporting (architecture §5.3). */
  totalCents(filter: { issueId?: string; kind?: TaskKind } = {}): number {
    return this.records
      .filter(
        (r) =>
          (filter.issueId === undefined || r.issueId === filter.issueId) &&
          (filter.kind === undefined || r.kind === filter.kind),
      )
      .reduce((sum, r) => sum + r.costCents, 0);
  }
}
