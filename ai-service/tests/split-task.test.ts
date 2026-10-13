import { describe, expect, it } from 'vitest';
import {
  sanitizeDependencies,
  splitTask,
  SPLIT_SCHEMA_VERSION,
} from '../src/index.js';
import { FakeBackend, makeIssue, stubGateway } from './helpers.js';

const SPLIT_OUTPUT = {
  subtasks: [
    { title: 'Design schema', description: 'Done when ERD reviewed', priority: 'high', stage: 1, dependsOn: [], labels: ['design'] },
    { title: 'Implement API', description: 'Done when endpoints pass tests', priority: 'high', stage: 2, dependsOn: ['Design schema'], labels: ['backend'] },
    { title: 'Build UI', description: 'Done when board renders', priority: 'medium', stage: 2, dependsOn: ['Design schema'], labels: ['frontend'] },
    { title: 'E2E tests', description: 'Done when CI green', priority: 'medium', stage: 3, dependsOn: ['Implement API', 'Build UI'], labels: ['tests'] },
  ],
  rationale: 'Schema first, then parallel API+UI, then E2E.',
};

describe('splitTask', () => {
  it('produces a schema-versioned draft with stages and dependencies', async () => {
    const backend = new FakeBackend();
    const issue = makeIssue({ id: 'issue-9' });
    backend.issues.set(issue.id, issue);

    const draft = await splitTask({
      gateway: stubGateway(SPLIT_OUTPUT),
      backend,
      issueId: 'issue-9',
    });

    expect(draft.schemaVersion).toBe(SPLIT_SCHEMA_VERSION);
    expect(draft.issueId).toBe('issue-9');
    expect(draft.subtasks).toHaveLength(4);
    expect(draft.subtasks[3]?.dependsOn).toEqual(['Implement API', 'Build UI']);
    expect(draft.rationale).toBeTruthy();
  });

  it('throws for a missing issue', async () => {
    await expect(
      splitTask({ gateway: stubGateway(SPLIT_OUTPUT), backend: new FakeBackend(), issueId: 'nope' }),
    ).rejects.toThrow('Issue not found');
  });
});

describe('sanitizeDependencies', () => {
  const base = { description: 'x', priority: 'medium' as const, stage: 1, labels: [] };

  it('strips references to unknown sibling titles', () => {
    const cleaned = sanitizeDependencies([
      { ...base, title: 'A', dependsOn: ['ghost'] },
      { ...base, title: 'B', dependsOn: ['A'] },
    ]);
    expect(cleaned[0]?.dependsOn).toEqual([]);
    expect(cleaned[1]?.dependsOn).toEqual(['A']);
  });

  it('drops self-references', () => {
    const cleaned = sanitizeDependencies([{ ...base, title: 'A', dependsOn: ['A'] }]);
    expect(cleaned[0]?.dependsOn).toEqual([]);
  });

  it('breaks dependency cycles', () => {
    const cleaned = sanitizeDependencies([
      { ...base, title: 'A', dependsOn: ['B'] },
      { ...base, title: 'B', dependsOn: ['A'] },
    ]);
    // One of the two edges must be gone — no cycle remains.
    const edges = cleaned.flatMap((s) => s.dependsOn.map((d) => `${d}->${s.title}`));
    expect(edges.length).toBeLessThan(2);
  });
});
