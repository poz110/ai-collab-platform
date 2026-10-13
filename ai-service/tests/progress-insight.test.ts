import { describe, expect, it } from 'vitest';
import {
  buildSnapshot,
  detectRisks,
  generateProgressInsight,
} from '../src/index.js';
import { FakeBackend, makeIssue, stubGateway } from './helpers.js';

const TODAY = '2026-10-14';

describe('buildSnapshot', () => {
  it('marks overdue issues and aggregates load', () => {
    const issues = [
      makeIssue({ id: '1', key: 'ACP-1', dueDate: '2026-10-10', status: 'in_progress' }),
      makeIssue({ id: '2', key: 'ACP-2', status: 'done', dueDate: '2026-10-10' }),
      makeIssue({ id: '3', key: 'ACP-3', assigneeType: 'member', assigneeId: 'm1' }),
    ];
    const snapshot = buildSnapshot(
      issues,
      [{ id: 'm1', name: 'Ada', skills: [], activeLoad: 0 }],
      TODAY,
    ) as { issues: Array<{ key: string; overdue: boolean }>; memberLoad: Array<{ name: string; openIssues: number }> };
    expect(snapshot.issues.find((i) => i.key === 'ACP-1')?.overdue).toBe(true);
    expect(snapshot.issues.find((i) => i.key === 'ACP-2')?.overdue).toBe(false);
    expect(snapshot.memberLoad[0]?.openIssues).toBe(1);
  });
});

describe('detectRisks', () => {
  it('flags overdue and blocked, skips done/cancelled', () => {
    const risks = detectRisks(
      [
        makeIssue({ key: 'ACP-1', dueDate: '2026-10-01', status: 'in_progress' }),
        makeIssue({ key: 'ACP-2', status: 'blocked' }),
        makeIssue({ key: 'ACP-3', dueDate: '2026-10-01', status: 'done' }),
      ],
      TODAY,
    );
    expect(risks.map((r) => `${r.issueKey}:${r.kind}`).sort()).toEqual([
      'ACP-1:overdue',
      'ACP-2:blocked',
    ]);
    expect(risks.find((r) => r.issueKey === 'ACP-1')?.severity).toBe('high');
  });
});

describe('generateProgressInsight', () => {
  it('merges deterministic risks with LLM output, deduped', async () => {
    const backend = new FakeBackend();
    backend.members = [];
    const issues = [
      makeIssue({ key: 'ACP-1', dueDate: '2026-10-01', status: 'in_progress' }),
    ];
    const llm = {
      summary: 'One overdue task.',
      risks: [
        { issueKey: 'ACP-1', severity: 'medium', kind: 'overdue', detail: 'late' }, // dup
        { issueKey: 'ACP-9', severity: 'low', kind: 'stale', detail: 'quiet' }, // new
      ],
      suggestions: ['Reassign ACP-1'],
    };
    const insight = await generateProgressInsight({
      gateway: stubGateway(llm),
      backend,
      projectId: 'proj-1',
      issues,
      today: TODAY,
    });
    expect(insight.summary).toBe('One overdue task.');
    const keys = insight.risks.map((r) => `${r.issueKey}:${r.kind}`);
    expect(keys).toEqual(['ACP-1:overdue', 'ACP-9:stale']);
    expect(insight.suggestions).toEqual(['Reassign ACP-1']);
  });
});
