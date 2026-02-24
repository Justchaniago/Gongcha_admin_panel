"use client";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebaseClient";

export default function LogoutButton() {
  const { user, loading } = useAuth();
  const router = useRouter();

  if (!user || loading) return null;

  async function handleLogout() {
    try {
      router.push("/login"); // ✅ redirect DULU sebelum signOut
      await signOut(auth);   // baru logout, listener keburu berhenti
    } catch (error) {
      console.error("Logout error:", error);
    }
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
      onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.background = '#FEF3F2'; }}
      onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
    >
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
        <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
        <path d="M16 17l5-5-5-5M21 12H9"/>
      </svg>
    </button>
  );
}