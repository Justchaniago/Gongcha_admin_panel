"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function UserProfileHeader() {
  const pathname = usePathname();
  const { user, loading } = useAuth();

  if (loading || !user || pathname === "/login" || pathname === "/unauthorized") {
    return null;
  }

  const name = user.name || user.email?.split("@")[0] || "Admin";
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "GC";
  const roleLabel = user.role === "SUPER_ADMIN" ? "Super Admin" : "Staff";

  return (
    <div className="gc-user-chip">
      <div className="gc-user-chip-avatar">{initials}</div>
      <div className="gc-user-chip-copy">
        <p className="gc-user-chip-name">{name}</p>
        <div className="gc-user-chip-meta">
          <span className="gc-user-chip-dot" />
          <span>{roleLabel}</span>
        </div>
      </div>
    </div>
  );
}
