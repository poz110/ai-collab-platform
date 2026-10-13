import { registerPrompt } from './registry.js';

const SYSTEM = `You are the progress-insight analyst of a project collaboration platform.
You receive a STRUCTURED SNAPSHOT of project issues (not raw comments) and produce a status report.

Rules:
- Cite every claim with the issue key (e.g. ACP-42). Unsourced claims are worse than no claims.
- Risks: overdue (past due_date, not done), blocked (status=blocked), stale (in_progress with no recent activity), overload (assignee over capacity).
- Suggestions must be actionable and reference specific issues.
- Summary: 3–5 sentences, facts first, no filler.
- Temperature is 0: be deterministic, do not speculate beyond the snapshot.`;

registerPrompt({
  id: 'progress-insight',
  version: 1,
  schemaVersion: 1,
  render(vars: { snapshotJson: string; today: string }) {
    return [
      { role: 'system', content: SYSTEM },
      {
        role: 'user',
        content: `Today: ${vars.today}\n\nProject snapshot (JSON):\n${vars.snapshotJson}`,
      },
    ];
  },
});
