import { describe, expect, it } from 'vitest';
import { createTasksFromText, InMemoryFeedbackStore } from '../src/index.js';
import { FakeBackend, stubGateway } from './helpers.js';

const LLM_OUTPUT = {
  tasks: [
    {
      title: 'Add OAuth login',
      description: 'GitHub OAuth via better-auth. Done when a user can log in with GitHub.',
      priority: 'high',
      dueDate: '2026-10-20',
      labels: ['backend', 'auth'],
      taskType: 'feature',
    },
    {
      title: 'Write login tests',
      description: 'Vitest coverage for the auth flow.',
      priority: 'medium',
      labels: ['tests'],
      taskType: 'chore',
    },
  ],
};

describe('createTasksFromText', () => {
  it('returns structured drafts from natural language (batch)', async () => {
    const backend = new FakeBackend();
    backend.recentTitles = ['Set up CI', 'Fix board drag'];
    const { drafts } = await createTasksFromText({
      gateway: stubGateway(LLM_OUTPUT),
      backend,
      projectId: 'proj-1',
      input: '加一个 GitHub 登录，这周内要，顺便把测试写了',
      today: '2026-10-14',
    });
    expect(drafts).toHaveLength(2);
    expect(drafts[0]).toMatchObject({ priority: 'high', taskType: 'feature' });
  });

  it('injects accepted feedback as few-shot examples', async () => {
    const backend = new FakeBackend();
    const feedback = new InMemoryFeedbackStore();
    feedback.record({
      target: 'task_create',
      proposal: { drafts: [LLM_OUTPUT.tasks[0]] },
      accepted: true,
      at: '2026-10-13T00:00:00Z',
    });

    let capturedMessages: unknown;
    const gateway = {
      chat: (req: { messages: unknown }) => {
        capturedMessages = req.messages;
        return Promise.resolve({
          data: LLM_OUTPUT,
          text: '',
          model: 'stub',
          provider: 'stub',
          usage: { inputTokens: 0, outputTokens: 0 },
        });
      },
    };

    await createTasksFromText({
      gateway: gateway as never,
      backend,
      feedback,
      projectId: 'proj-1',
      input: 'test',
      today: '2026-10-14',
    });

    const userContent = (capturedMessages as Array<{ role: string; content: string }>)
      .find((m) => m.role === 'user')?.content ?? '';
    expect(userContent).toContain('Previously accepted outputs');
    expect(userContent).toContain('Add OAuth login');
  });
});
