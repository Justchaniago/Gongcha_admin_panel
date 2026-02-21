"use client";
// src/components/LogoutButton.tsx
// Drop this anywhere in Sidebar to show user info + logout

import { useAuth } from "@/context/AuthContext";

const C = {
  tx1: '#0F1117', tx2: '#4A5065', tx3: '#9299B0',
  border: '#EAECF2', bg: '#F4F6FB',
  red: '#C8102E', redBg: '#FEF3F2',
} as const;
const font = "'Plus Jakarta Sans', system-ui, sans-serif";


export default function LogoutButton() {
  const { user, loading } = useAuth();
  const router = require("next/navigation").useRouter();
  if (!user || loading) return null;
  async function handleLogout() {
    const { getAuth, signOut } = await import("firebase/auth");
    const { app } = await import("@/lib/firebaseClient");
    await signOut(getAuth(app));
    router.push("/login");
  }
  return (
    <button
      onClick={handleLogout}
      title={`Logout (${user.email || ''})`}
      style={{
        width: 44, height: 44, borderRadius: 12,
        border: 'none', background: 'none',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#C8102E', marginTop: 8, marginBottom: 4,
        transition: 'background .14s',
      }}
      onMouseOver={e => {
        (e.currentTarget as HTMLButtonElement).style.background = '#FEF3F2';
      }}
      onMouseOut={e => {
        (e.currentTarget as HTMLButtonElement).style.background = 'none';
      }}
    >
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
        <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
        <path d="M16 17l5-5-5-5M21 12H9"/>
      </svg>
    </button>
  );
}
