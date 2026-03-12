"use client";

import { useEffect } from "react";
import { GcButton, GcPanel } from "@/components/ui/gc";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Dashboard Error]", error);
  }, [error]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F4F6FB", padding: "20px" }}>
      <GcPanel style={{ borderRadius: "16px", padding: "32px", maxWidth: "500px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: "700", color: "#C8102E", marginBottom: "12px" }}>
          ❌ Dashboard Error
        </h2>
        <p style={{ fontSize: "14px", color: "#4A5065", marginBottom: "20px", lineHeight: "1.6" }}>
          {error.message || "An error occurred while loading the dashboard. Please try refreshing the page."}
        </p>
        {error.digest && (
          <p style={{ fontSize: "12px", color: "#9299B0", marginBottom: "20px", fontFamily: "monospace", background: "#F4F6FB", padding: "10px", borderRadius: "8px", overflow: "auto" }}>
            Error ID: {error.digest}
          </p>
        )}
        <GcButton variant="blue" size="lg" onClick={reset}>
          Try Again
        </GcButton>
      </GcPanel>
    </div>
  );
}
