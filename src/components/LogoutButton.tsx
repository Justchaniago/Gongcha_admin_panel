"use client";
import { useAuth } from "@/context/AuthContext";
// import { signOut } from "firebase/auth";
// import { auth } from "@/lib/firebaseClient";

export default function LogoutButton() {
  const { user, loading, logout } = useAuth();

  if (!user || loading) return null;

  async function handleLogout() {
    try {
      await logout();
    } catch (error) {
      console.error("Logout error:", error);
    }
  }

  return (
    <button
      onClick={handleLogout}
      title={`Logout (${user.email || ''})`}
      className="gc-logout-btn"
    >
      <span className="gc-logout-inner">
        <span className="gc-sidebar-icon">
          <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
            <path d="M16 17l5-5-5-5M21 12H9"/>
          </svg>
        </span>
        <span className="gc-logout-label">Logout</span>
      </span>
    </button>
  );
}
