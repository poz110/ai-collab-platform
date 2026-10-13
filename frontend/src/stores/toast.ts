"use client";

import { create } from "zustand";

interface ToastItem {
  id: number;
  message: string;
  kind: "info" | "success" | "error";
}

interface ToastState {
  toasts: ToastItem[];
  push: (message: string, kind?: ToastItem["kind"]) => void;
  dismiss: (id: number) => void;
}

let seq = 0;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (message, kind = "info") => {
    const id = ++seq;
    set((s) => ({ toasts: [...s.toasts, { id, message, kind }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 3000);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function toast(message: string, kind: ToastItem["kind"] = "info") {
  useToastStore.getState().push(message, kind);
}
