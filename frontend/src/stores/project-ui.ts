"use client";

import { create } from "zustand";
import type { IssueFilters } from "@/hooks/use-issues";

export type ViewMode = "board" | "list" | "calendar";

interface ProjectUiState {
  view: ViewMode;
  filters: IssueFilters;
  /** 当前打开的任务抽屉（issue id），null 表示关闭 */
  activeIssueId: string | null;
  setView: (v: ViewMode) => void;
  setFilters: (f: Partial<IssueFilters>) => void;
  resetFilters: () => void;
  openIssue: (id: string) => void;
  closeIssue: () => void;
}

export const useProjectUiStore = create<ProjectUiState>((set) => ({
  view: "board",
  filters: {},
  activeIssueId: null,
  setView: (view) => set({ view }),
  setFilters: (f) => set((s) => ({ filters: { ...s.filters, ...f } })),
  resetFilters: () => set({ filters: {} }),
  openIssue: (id) => set({ activeIssueId: id }),
  closeIssue: () => set({ activeIssueId: null }),
}));
