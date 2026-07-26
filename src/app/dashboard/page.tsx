"use client";

import React, { useEffect, useState } from "react";
import { FastApiAdminGateway } from "@/lib/api/FastApiAdminGateway";
import { DashboardStats } from "@/lib/api/types";
import DashboardClient from "./DashboardClient";
import { C, typography } from "@/lib/design-tokens";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadStats() {
      try {
        const data = await FastApiAdminGateway.getDashboardStats();
        setStats(data);
      } catch (err: any) {
        console.error("Failed to fetch dashboard stats:", err);
        setError(err.message || "Failed to fetch dashboard stats");
      } finally {
        setLoading(false);
      }
    }
    loadStats();
    const interval = setInterval(loadStats, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Premium Active Metrics Bar */}
      <div>
        <h2 style={{ ...typography.headingSm, color: C.tx2, marginBottom: "16px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Active Metrics (FastAPI Gateway)
        </h2>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "20px"
        }}>
          {/* Card 1: Total Members */}
          <div style={{
            background: `linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)`,
            borderRadius: "18px",
            padding: "24px",
            color: "#FFFFFF",
            boxShadow: "0 10px 25px -5px rgba(59, 130, 246, 0.4)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            transition: "transform 0.2s ease, box-shadow 0.2s ease",
            cursor: "default"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-4px)";
            e.currentTarget.style.boxShadow = "0 15px 30px -5px rgba(59, 130, 246, 0.5)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "0 10px 25px -5px rgba(59, 130, 246, 0.4)";
          }}>
            <div>
              <span style={{ fontSize: "11px", fontWeight: 700, opacity: 0.8, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Total Members
              </span>
              <p style={{ fontSize: "32px", fontWeight: 800, margin: "12px 0 0 0", letterSpacing: "-0.02em" }}>
                {loading ? "..." : stats?.total_members?.toLocaleString() ?? "—"}
              </p>
            </div>
            <div style={{ fontSize: "12px", opacity: 0.7, marginTop: "14px" }}>
              Registered customers
            </div>
          </div>

          {/* Card 2: Today Transactions */}
          <div style={{
            background: `linear-gradient(135deg, #10B981 0%, #047857 100%)`,
            borderRadius: "18px",
            padding: "24px",
            color: "#FFFFFF",
            boxShadow: "0 10px 25px -5px rgba(16, 185, 129, 0.4)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            transition: "transform 0.2s ease, box-shadow 0.2s ease",
            cursor: "default"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-4px)";
            e.currentTarget.style.boxShadow = "0 15px 30px -5px rgba(16, 185, 129, 0.5)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "0 10px 25px -5px rgba(16, 185, 129, 0.4)";
          }}>
            <div>
              <span style={{ fontSize: "11px", fontWeight: 700, opacity: 0.8, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Today Transactions
              </span>
              <p style={{ fontSize: "32px", fontWeight: 800, margin: "12px 0 0 0", letterSpacing: "-0.02em" }}>
                {loading ? "..." : stats?.total_transactions_today?.toLocaleString() ?? "—"}
              </p>
            </div>
            <div style={{ fontSize: "12px", opacity: 0.7, marginTop: "14px" }}>
              Completed today
            </div>
          </div>

          {/* Card 3: Today Revenue */}
          <div style={{
            background: `linear-gradient(135deg, #F59E0B 0%, #B45309 100%)`,
            borderRadius: "18px",
            padding: "24px",
            color: "#FFFFFF",
            boxShadow: "0 10px 25px -5px rgba(245, 158, 11, 0.4)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            transition: "transform 0.2s ease, box-shadow 0.2s ease",
            cursor: "default"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-4px)";
            e.currentTarget.style.boxShadow = "0 15px 30px -5px rgba(245, 158, 11, 0.5)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "0 10px 25px -5px rgba(245, 158, 11, 0.4)";
          }}>
            <div>
              <span style={{ fontSize: "11px", fontWeight: 700, opacity: 0.8, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Today Revenue
              </span>
              <p style={{ fontSize: "32px", fontWeight: 800, margin: "12px 0 0 0", letterSpacing: "-0.02em" }}>
                Rp {loading ? "..." : (stats?.total_revenue_today ?? 0).toLocaleString("id-ID")}
              </p>
            </div>
            <div style={{ fontSize: "12px", opacity: 0.7, marginTop: "14px" }}>
              Gross sales today
            </div>
          </div>

          {/* Card 4: Active Vouchers */}
          <div style={{
            background: `linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)`,
            borderRadius: "18px",
            padding: "24px",
            color: "#FFFFFF",
            boxShadow: "0 10px 25px -5px rgba(139, 92, 246, 0.4)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            transition: "transform 0.2s ease, box-shadow 0.2s ease",
            cursor: "default"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-4px)";
            e.currentTarget.style.boxShadow = "0 15px 30px -5px rgba(139, 92, 246, 0.5)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "0 10px 25px -5px rgba(139, 92, 246, 0.4)";
          }}>
            <div>
              <span style={{ fontSize: "11px", fontWeight: 700, opacity: 0.8, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Active Vouchers
              </span>
              <p style={{ fontSize: "32px", fontWeight: 800, margin: "12px 0 0 0", letterSpacing: "-0.02em" }}>
                {loading ? "..." : stats?.active_vouchers?.toLocaleString() ?? "—"}
              </p>
            </div>
            <div style={{ fontSize: "12px", opacity: 0.7, marginTop: "14px" }}>
              In circulation
            </div>
          </div>
        </div>
      </div>

      {/* Main Dashboard Client */}
      <DashboardClient initialRole={""} initialTransactions={[]} initialUsers={[]} initialStores={[]} />
    </div>
  );
}