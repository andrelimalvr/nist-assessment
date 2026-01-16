"use client";

import { useEffect } from "react";
import { SessionProvider } from "next-auth/react";
import { applyTheme, resolveTheme } from "@/lib/theme";

export default function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const theme = resolveTheme();
    applyTheme(theme);
  }, []);

  return <SessionProvider>{children}</SessionProvider>;
}
