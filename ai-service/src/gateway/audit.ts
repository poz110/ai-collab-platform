import type { AuditEntry, AuditSink } from '../types.js';

/** In-memory audit sink — production uses Postgres (architecture §5.1). */
export class InMemoryAuditSink implements AuditSink {
  readonly entries: AuditEntry[] = [];

  record(entry: AuditEntry): void {
    this.entries.push(entry);
  }
}
