import { registerPrompt } from './registry.js';

/**
 * Assignee EXPLANATION prompt. Ranking is done by the deterministic rule
 * engine (architecture.md §5.2: cold start rules out ML ranking) — the LLM
 * only turns the rule hits into a human-readable rationale.
 */
registerPrompt({
  id: 'assignee-explain',
  version: 1,
  schemaVersion: 1,
  render(vars: {
    taskTitle: string;
    taskLabels: string[];
    candidates: Array<{
      name: string;
      score: number;
      reasons: string[];
    }>;
  }) {
    return [
      {
        role: 'system',
        content:
          'You explain assignment recommendations from a deterministic rule engine. ' +
          'Be factual and concise (≤ 80 words per candidate): restate WHY each candidate scores as it does ' +
          'using only the provided reasons. Never invent qualifications. If a reason list is thin, say so.',
      },
      {
        role: 'user',
        content:
          `Task: ${vars.taskTitle}\nLabels: ${vars.taskLabels.join(', ') || '(none)'}\n\n` +
          `Candidates (already ranked):\n${vars.candidates
            .map(
              (c, i) =>
                `${i + 1}. ${c.name} — score ${c.score.toFixed(2)}\n   reasons: ${c.reasons.join('; ') || 'none'}`,
            )
            .join('\n')}`,
      },
    ];
  },
});
