"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import type {
  BoardResponse,
  Issue,
  IssueDetail,
  IssuePriority,
  IssueStatus,
  ListResponse,
} from "@/lib/types";

export interface IssueFilters {
  q?: string;
  status?: IssueStatus[];
  priority?: IssuePriority[];
  assigneeId?: string;
  label?: string;
  sort?: "dueDate" | "priority" | "createdAt";
  order?: "asc" | "desc";
}

function buildListQuery(filters: IssueFilters): string {
  const params = new URLSearchParams();
  params.set("view", "list");
  if (filters.q) params.set("q", filters.q);
  if (filters.status?.length) params.set("status", filters.status.join(","));
  if (filters.priority?.length) params.set("priority", filters.priority.join(","));
  if (filters.assigneeId) params.set("assigneeId", filters.assigneeId);
  if (filters.label) params.set("label", filters.label);
  if (filters.sort) params.set("sort", filters.sort);
  if (filters.order) params.set("order", filters.order);
  return params.toString();
}

/** 看板视图（含 15s 聚焦轮询兜底实时性，见 api-spec §SSE） */
export function useBoardIssues(projectId: string) {
  return useQuery({
    queryKey: ["projects", projectId, "issues", "board"],
    queryFn: () => apiGet<BoardResponse>(`/projects/${projectId}/issues?view=board`),
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });
}

export function useListIssues(projectId: string, filters: IssueFilters) {
  const qs = buildListQuery(filters);
  return useQuery({
    queryKey: ["projects", projectId, "issues", "list", qs],
    queryFn: () => apiGet<ListResponse>(`/projects/${projectId}/issues?${qs}`),
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });
}

export function useIssue(issueId: string | null) {
  return useQuery({
    queryKey: ["issues", issueId],
    queryFn: () => apiGet<IssueDetail>(`/issues/${issueId}`),
    enabled: !!issueId,
  });
}

export interface CreateIssueBody {
  projectId: string;
  title: string;
  description?: string;
  priority?: IssuePriority;
  labels?: string[];
  dueDate?: string;
  assigneeId?: string;
  parentId?: string;
}

export function useCreateIssue(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateIssueBody) => apiPost<Issue>("/issues", body),
    onSuccess: (issue) => {
      qc.invalidateQueries({ queryKey: ["projects", projectId, "issues"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      if (issue.parentId) {
        qc.invalidateQueries({ queryKey: ["issues", issue.parentId] });
      }
    },
  });
}

export interface UpdateIssueBody {
  title?: string;
  description?: string;
  priority?: IssuePriority;
  labels?: string[];
  dueDate?: string | null;
  assigneeId?: string | null;
  status?: IssueStatus;
}

export function useUpdateIssue(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateIssueBody }) =>
      apiPatch<Issue>(`/issues/${id}`, body),
    onSuccess: (issue) => {
      qc.invalidateQueries({ queryKey: ["projects", projectId, "issues"] });
      qc.invalidateQueries({ queryKey: ["issues", issue.id] });
      if (issue.parentId) {
        qc.invalidateQueries({ queryKey: ["issues", issue.parentId] });
      }
    },
  });
}

export function useDeleteIssue(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<void>(`/issues/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects", projectId, "issues"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export interface MoveIssueBody {
  status: IssueStatus;
  beforeId?: string;
  afterId?: string;
}

/** 看板拖拽移动（乐观更新由调用方在 board 组件中处理） */
export function useMoveIssue(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: MoveIssueBody }) =>
      apiPost<Issue>(`/issues/${id}/move`, body),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["projects", projectId, "issues"] });
    },
  });
}

export function useAddComment(issueId: string, projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) =>
      apiPost(`/issues/${issueId}/comments`, { content }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["issues", issueId] });
      qc.invalidateQueries({ queryKey: ["projects", projectId, "issues"] });
    },
  });
}
