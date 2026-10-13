import type {
  BackendDataProvider,
  CommentRef,
  IssueRef,
  MemberProfile,
  AgentProfile,
} from '../src/types.js';
import type { LLMGateway } from '../src/index.js';

export function makeIssue(overrides: Partial<IssueRef> = {}): IssueRef {
  return {
    id: 'issue-1',
    key: 'ACP-1',
    title: 'Build the thing',
    description: 'Implement the core feature',
    status: 'todo',
    priority: 'medium',
    projectId: 'proj-1',
    labels: ['backend'],
    createdAt: '2026-10-01T00:00:00Z',
    ...overrides,
  };
}

export class FakeBackend implements BackendDataProvider {
  issues = new Map<string, IssueRef>();
  members: MemberProfile[] = [];
  agents: AgentProfile[] = [];
  comments = new Map<string, CommentRef[]>();
  recentTitles: string[] = [];

  async getIssue(issueId: string): Promise<IssueRef | null> {
    return this.issues.get(issueId) ?? null;
  }
  async listRecentIssueTitles(_projectId: string, limit: number): Promise<string[]> {
    return this.recentTitles.slice(0, limit);
  }
  async listMembers(_projectId: string): Promise<MemberProfile[]> {
    return this.members;
  }
  async listAgents(_projectId: string): Promise<AgentProfile[]> {
    return this.agents;
  }
  async listRecentComments(issueId: string, limit: number): Promise<CommentRef[]> {
    return (this.comments.get(issueId) ?? []).slice(-limit);
  }
}

/** A gateway stand-in that always resolves `data` from chat(). */
export function stubGateway(data: unknown): LLMGateway {
  return {
    chat: () =>
      Promise.resolve({
        data,
        text: JSON.stringify(data),
        model: 'stub',
        provider: 'stub',
        usage: { inputTokens: 0, outputTokens: 0 },
      }),
  } as unknown as LLMGateway;
}
