import { describe, expect, it } from 'vitest';
import {
  clearPromptRegistry,
  getPrompt,
  InMemoryFeedbackStore,
  listPrompts,
  registerPrompt,
} from '../src/index.js';

describe('prompt registry', () => {
  it('serves the latest version by default and pins on request', () => {
    clearPromptRegistry();
    registerPrompt({ id: 'p', version: 1, schemaVersion: 1, render: () => [] });
    registerPrompt({ id: 'p', version: 2, schemaVersion: 1, render: () => [] });
    expect(getPrompt('p').version).toBe(2);
    expect(getPrompt('p', 1).version).toBe(1);
    expect(listPrompts()).toEqual([{ id: 'p', versions: [1, 2] }]);
  });

  it('throws for unknown templates', () => {
    clearPromptRegistry();
    expect(() => getPrompt('nope')).toThrow('Unknown prompt template');
  });
});

describe('InMemoryFeedbackStore', () => {
  it('tracks acceptance accuracy per target', async () => {
    const store = new InMemoryFeedbackStore();
    store.record({ target: 'task_split', proposal: {}, accepted: true, at: '2026-10-13T00:00:00Z' });
    store.record({ target: 'task_split', proposal: {}, accepted: true, at: '2026-10-14T00:00:00Z' });
    store.record({ target: 'task_split', proposal: {}, accepted: false, at: '2026-10-14T01:00:00Z' });
    store.record({ target: 'task_create', proposal: {}, accepted: true, at: '2026-10-14T00:00:00Z' });

    expect(await store.accuracy('task_split')).toEqual({ total: 3, accepted: 2 });
    expect(await store.accuracy('task_create')).toEqual({ total: 1, accepted: 1 });

    const accepted = await store.listAccepted('task_split', 10);
    expect(accepted).toHaveLength(2);
    expect(accepted[0]?.at).toBe('2026-10-14T00:00:00Z'); // most recent first
  });
});
