"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import type { MeResponse, Session } from "@/lib/types";

/** 当前会话（better-auth get-session）。未登录返回 null。 */
export function useSession() {
  return useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const data = await apiGet<Session | null>("/auth/get-session");
      return data ?? null;
    },
    staleTime: 30_000,
  });
}

export function useMe(enabled = true) {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => apiGet<MeResponse>("/me"),
    enabled,
    staleTime: 30_000,
  });
}

export function useUpdateMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name?: string }) => apiPatch<MeResponse>("/me", body),
    onSuccess: (data) => {
      qc.setQueryData(["me"], data);
      qc.invalidateQueries({ queryKey: ["session"] });
    },
  });
}

export function useSignOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost<unknown>("/auth/sign-out"),
    onSettled: () => {
      qc.clear();
      window.location.href = "/login";
    },
  });
}
