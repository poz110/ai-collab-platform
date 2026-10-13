import type { TaskKind } from '../types.js';

/**
 * Model routing table (architecture.md §5.1): cheap/fast models for
 * interactive work, stronger models only for genuinely hard reasoning,
 * OpenAI-compatible fallback for domestic deployments.
 */
export interface RouteRule {
  /** Preferred model for the task kind. */
  primary: string;
  /** Used when the primary provider errors out or is unconfigured. */
  fallback?: string;
  temperature: number;
  maxTokens: number;
}

export type RoutingTable = Record<TaskKind, RouteRule>;

export const DEFAULT_ROUTING: RoutingTable = {
  task_create: {
    primary: 'claude-sonnet-4-6',
    fallback: 'gpt-4o-mini',
    temperature: 0.2,
    maxTokens: 2048,
  },
  task_split: {
    primary: 'claude-sonnet-4-6',
    fallback: 'gpt-4o-mini',
    temperature: 0.2,
    maxTokens: 4096,
  },
  suggest_assignee: {
    // Rule engine does the ranking; the LLM only writes the explanation.
    primary: 'claude-sonnet-4-6',
    fallback: 'gpt-4o-mini',
    temperature: 0.4,
    maxTokens: 512,
  },
  progress_insight: {
    primary: 'claude-sonnet-4-6',
    fallback: 'gpt-4o-mini',
    temperature: 0, // per architecture §5.2
    maxTokens: 2048,
  },
  explain: {
    primary: 'claude-sonnet-4-6',
    fallback: 'gpt-4o-mini',
    temperature: 0.4,
    maxTokens: 1024,
  },
};

export function resolveRoute(
  kind: TaskKind,
  override: string | undefined,
  table: RoutingTable = DEFAULT_ROUTING,
): { model: string; fallback?: string; temperature: number; maxTokens: number } {
  const rule = table[kind];
  if (override) {
    return {
      model: override,
      ...(rule.fallback !== undefined ? { fallback: rule.fallback } : {}),
      temperature: rule.temperature,
      maxTokens: rule.maxTokens,
    };
  }
  return {
    model: rule.primary,
    ...(rule.fallback !== undefined ? { fallback: rule.fallback } : {}),
    temperature: rule.temperature,
    maxTokens: rule.maxTokens,
  };
}
