import type { BackendDataProvider, CommentRef, IssueRef } from '../types.js';

export interface ContextWindowOptions {
  /** Max comments pulled into the prompt (architecture §5.2: 20). */
  maxComments: number;
  /** Hard character budget for the assembled context block. */
  maxChars: number;
}

export const DEFAULT_WINDOW: ContextWindowOptions = {
  maxComments: 20,
  maxChars: 12_000,
};

/**
 * Sliding-window context assembly (architecture.md §5.2): issue body +
 * parent chain + recent comments. When the window overflows, older
 * comments are compressed to one-line digests rather than dropped.
 */
export async function assembleIssueContext(
  backend: BackendDataProvider,
  issue: IssueRef,
  opts: ContextWindowOptions = DEFAULT_WINDOW,
): Promise<string> {
  const parts: string[] = [];

  // Parent chain (walk up to 5 levels).
  let cursor: IssueRef | undefined = issue;
  const chain: IssueRef[] = [];
  while (cursor?.parentId && chain.length < 5) {
    const parent: IssueRef | null = await backend.getIssue(cursor.parentId);
    if (!parent) break;
    chain.unshift(parent);
    cursor = parent;
  }
  if (chain.length) {
    parts.push(
      'Parent chain:\n' +
        chain.map((p) => `- [${p.key}] ${p.title} (${p.status})`).join('\n'),
    );
  }

  parts.push(
    `Issue [${issue.key}] ${issue.title}\nStatus: ${issue.status} | Priority: ${issue.priority}` +
      (issue.dueDate ? ` | Due: ${issue.dueDate}` : '') +
      `\nDescription:\n${issue.description}`,
  );

  const comments = await backend.listRecentComments(issue.id, opts.maxComments);
  if (comments.length) {
    parts.push(`Recent comments (${comments.length}):\n` + renderComments(comments));
  }

  const assembled = parts.join('\n\n');
  if (assembled.length <= opts.maxChars) return assembled;

  // Overflow: keep issue body intact, compress comments to digests.
  const digests = comments.map(digest).join('\n');
  return (
    parts.slice(0, -1).join('\n\n') +
    `\n\nRecent comments (compressed):\n${digests}`
  ).slice(0, opts.maxChars);
}

function renderComments(comments: CommentRef[]): string {
  return comments
    .map((c) => `- (${c.authorType}, ${c.createdAt.slice(0, 10)}) ${c.content}`)
    .join('\n');
}

function digest(c: CommentRef): string {
  const firstLine = c.content.split('\n')[0] ?? '';
  return `- (${c.authorType}) ${firstLine.slice(0, 120)}`;
}
