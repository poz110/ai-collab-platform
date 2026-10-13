import { describe, expect, it } from 'vitest';
import { scoreCandidate, suggestAssignee } from '../src/index.js';
import { FakeBackend, makeIssue, stubGateway } from './helpers.js';

describe('scoreCandidate', () => {
  it('rewards skill match and penalizes load', () => {
    const task = { labels: ['react'], title: 'Fix board drag', description: '' };
    const skilled = scoreCandidate(
      { skills: ['react', 'frontend'], activeLoad: 1 },
      task,
    );
    const busy = scoreCandidate(
      { skills: ['react', 'frontend'], activeLoad: 5 },
      task,
    );
    const unskilled = scoreCandidate({ skills: ['go'], activeLoad: 1 }, task);
    expect(skilled.score).toBeGreaterThan(busy.score);
    expect(skilled.score).toBeGreaterThan(unskilled.score);
    expect(skilled.reasons.join()).toContain('react');
  });

  it('treats missing history as a neutral prior', () => {
    const withHistory = scoreCandidate(
      { skills: [], activeLoad: 0, historicalAcceptance: 0.9 },
      { labels: [], title: '', description: '' },
    );
    const without = scoreCandidate(
      { skills: [], activeLoad: 0 },
      { labels: [], title: '', description: '' },
    );
    expect(withHistory.score).toBeGreaterThan(without.score);
  });
});

describe('suggestAssignee', () => {
  it('ranks members and agents, excludes the overloaded', async () => {
    const backend = new FakeBackend();
    const issue = makeIssue({ labels: ['react'], title: 'Polish board UI' });
    backend.issues.set(issue.id, issue);
    backend.members = [
      { id: 'm1', name: 'Ada', skills: ['react', 'frontend'], activeLoad: 1, historicalAcceptance: 0.8 },
      { id: 'm2', name: 'Bo', skills: ['go'], activeLoad: 0 },
      { id: 'm3', name: 'Cy', skills: ['react'], activeLoad: 5, capacity: 5 }, // full
    ];
    backend.agents = [
      { id: 'a1', name: 'claude cli', runtime: 'claude-code', capabilities: ['backend', 'tests'], activeLoad: 0 },
    ];

    const { suggestions } = await suggestAssignee({
      backend,
      issueId: issue.id,
      gateway: stubGateway({ explanations: [] }),
    });

    expect(suggestions[0]?.name).toBe('Ada');
    expect(suggestions.map((s) => s.name)).not.toContain('Cy');
    expect(suggestions.some((s) => s.assigneeType === 'agent')).toBe(true);
  });

  it('attaches LLM explanations to top candidates', async () => {
    const backend = new FakeBackend();
    const issue = makeIssue({ labels: ['react'] });
    backend.issues.set(issue.id, issue);
    backend.members = [
      { id: 'm1', name: 'Ada', skills: ['react'], activeLoad: 0 },
    ];

    const { suggestions } = await suggestAssignee({
      backend,
      issueId: issue.id,
      gateway: stubGateway({
        explanations: [{ name: 'Ada', explanation: 'Strong react match, idle.' }],
      }),
    });

    expect(suggestions[0]?.explanation).toBe('Strong react match, idle.');
  });

  it('works without a gateway (rule-engine only)', async () => {
    const backend = new FakeBackend();
    const issue = makeIssue();
    backend.issues.set(issue.id, issue);
    backend.members = [{ id: 'm1', name: 'Ada', skills: ['backend'], activeLoad: 0 }];

    const { suggestions } = await suggestAssignee({ backend, issueId: issue.id });
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]?.explanation).toBeUndefined();
  });
});
