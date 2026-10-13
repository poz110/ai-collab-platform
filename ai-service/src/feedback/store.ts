import type { FeedbackEvent, FeedbackStore, FeedbackTarget } from '../types.js';

/**
 * In-memory feedback store — the production implementation persists to
 * Postgres and is provided by the backend.
 *
 * The feedback loop (issue spec: 用户反馈循环):
 * - record() every accept/reject/edit of an AI proposal.
 * - listAccepted() feeds few-shot examples back into prompts.
 * - accuracy() powers the 准确率评估 metric in DEV-6's completion criteria.
 */
export class InMemoryFeedbackStore implements FeedbackStore {
  private readonly events: FeedbackEvent[] = [];

  record(event: FeedbackEvent): void {
    this.events.push(event);
  }

  listAccepted(target: FeedbackTarget, limit: number): Promise<FeedbackEvent[]> {
    return Promise.resolve(
      this.events
        .filter((e) => e.target === target && e.accepted)
        .sort((a, b) => (a.at < b.at ? 1 : -1))
        .slice(0, limit),
    );
  }

  accuracy(target: FeedbackTarget): Promise<{ total: number; accepted: number }> {
    const relevant = this.events.filter((e) => e.target === target);
    return Promise.resolve({
      total: relevant.length,
      accepted: relevant.filter((e) => e.accepted).length,
    });
  }
}
