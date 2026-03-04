"use client";

import { useEffect } from "react";

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
      <div style={{ background: "white", borderRadius: "16px", padding: "32px", maxWidth: "500px", boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}>
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
        <button
          onClick={reset}
          style={{
            padding: "10px 20px",
            borderRadius: "8px",
            border: "none",
            background: "#4361EE",
            color: "white",
            fontSize: "14px",
            fontWeight: "600",
            cursor: "pointer",
            transition: "background 0.2s"
          }}
          onMouseOver={(e) => (e.currentTarget.style.background = "#3A0CA3")}
          onMouseOut={(e) => (e.currentTarget.style.background = "#4361EE")}
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
