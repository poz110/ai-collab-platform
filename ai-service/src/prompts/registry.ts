/**
 * Versioned prompt template registry (architecture.md §8 risk 4: prompt
 * drift is managed by versioning, never by editing a live template).
 *
 * Rules for authors:
 * - NEVER edit a template in place. Add a new version and bump
 *   `activeVersion`; old versions stay for audit replay.
 * - Every template declares the schema version its output conforms to.
 * - Templates are plain functions — no hidden state, trivially testable.
 */

import type { ChatMessage } from '../types.js';

export interface PromptTemplate<V extends Record<string, unknown> = Record<string, unknown>> {
  id: string;
  version: number;
  /** Schema version the output conforms to (draft compat check). */
  schemaVersion: number;
  render(vars: V): ChatMessage[];
}

const registry = new Map<string, PromptTemplate[]>();

export function registerPrompt(template: PromptTemplate): void {
  const versions = registry.get(template.id) ?? [];
  versions.push(template);
  versions.sort((a, b) => a.version - b.version);
  registry.set(template.id, versions);
}

export function getPrompt(id: string, version?: number): PromptTemplate {
  const versions = registry.get(id);
  if (!versions?.length) throw new Error(`Unknown prompt template: ${id}`);
  const found = version
    ? versions.find((t) => t.version === version)
    : versions[versions.length - 1];
  if (!found) throw new Error(`Prompt ${id} has no version ${version}`);
  return found;
}

export function listPrompts(): Array<{ id: string; versions: number[] }> {
  return [...registry.entries()].map(([id, versions]) => ({
    id,
    versions: versions.map((t) => t.version),
  }));
}

/** Test helper. */
export function clearPromptRegistry(): void {
  registry.clear();
}
