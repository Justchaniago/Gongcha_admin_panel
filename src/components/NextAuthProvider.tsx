"use client";
// src/components/NextAuthProvider.tsx
// Wraps the app with next-auth SessionProvider so useSession() works everywhere.

import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";

export default function NextAuthProvider({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
