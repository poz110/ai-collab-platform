"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import type { Project, ProjectDetail, ProjectMember, ProjectRole } from "@/lib/types";

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: () => apiGet<Project[]>("/projects"),
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: ["projects", id],
    queryFn: () => apiGet<ProjectDetail>(`/projects/${id}`),
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; key: string; description?: string }) =>
      apiPost<Project>("/projects", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useUpdateProject(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name?: string; description?: string }) =>
      apiPatch<Project>(`/projects/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["projects", id] });
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<void>(`/projects/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useProjectMembers(projectId: string) {
  return useQuery({
    queryKey: ["projects", projectId, "members"],
    queryFn: () => apiGet<ProjectMember[]>(`/projects/${projectId}/members`),
  });
}

export function useAddProjectMember(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; role: ProjectRole }) =>
      apiPost<ProjectMember>(`/projects/${projectId}/members`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects", projectId, "members"] });
      qc.invalidateQueries({ queryKey: ["projects", projectId] });
    },
  });
}

export function useUpdateProjectMember(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: ProjectRole }) =>
      apiPatch<ProjectMember>(`/projects/${projectId}/members/${memberId}`, { role }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects", projectId, "members"] });
    },
  });
}

export function useRemoveProjectMember(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) =>
      apiDelete<void>(`/projects/${projectId}/members/${memberId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects", projectId, "members"] });
      qc.invalidateQueries({ queryKey: ["projects", projectId] });
    },
  });
}
