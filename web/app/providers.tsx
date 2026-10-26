"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "framer-motion";
import { ToastProvider } from "@/components/ui/slide-in-notifications";
import { AuthDialog } from "@/components/auth/auth-dialog";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false },
          mutations: { retry: 0 },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      {/* reducedMotion="user" makes every framer-motion animation honour the
          OS "reduce motion" setting globally (WCAG 2.3.3). */}
      <MotionConfig reducedMotion="user">
        <ToastProvider>
          {children}
          <AuthDialog />
        </ToastProvider>
      </MotionConfig>
    </QueryClientProvider>
  );
}
