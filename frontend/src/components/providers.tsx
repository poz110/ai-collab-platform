"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";
import { ApiError } from "@/lib/api";
import { toast } from "@/stores/toast";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: (count, error) => {
              // 4xx 不重试；网络/5xx 重试一次
              if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
                return false;
              }
              return count < 1;
            },
            refetchOnWindowFocus: true,
            staleTime: 5_000,
          },
          mutations: {
            onError: (error) => {
              if (error instanceof ApiError) {
                if (error.status === 401) return; // 已跳登录
                toast(error.message, "error");
              } else {
                toast("网络错误，请稍后重试", "error");
              }
            },
          },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
