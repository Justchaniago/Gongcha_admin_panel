import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebaseClient";

export default function UserProfileHeader() {
  const [user, setUser] = useState<{ email: string; displayName?: string } | null>(null);
  const router = useRouter();

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          email: firebaseUser.email || "",
          displayName: firebaseUser.displayName || undefined,
        });
      } else {
        setUser(null);
      }
    });
    return () => unsub();
  }, []);

  const handleLogout = async () => {
    const auth = getAuth();
    await signOut(auth);
    router.push("/login");
  };

  return (
    <header className="w-full flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="font-bold text-lg text-blue-700">Admin Panel</span>
      </div>
      <nav className="flex items-center gap-4">
        {user ? (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">
              {user.displayName ? user.displayName : user.email}
            </span>
            <button
              onClick={handleLogout}
              className="ml-2 px-3 py-1 rounded bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition"
              aria-label="Logout"
            >
              Logout
            </button>
          </div>
        ) : (
          <span className="text-sm text-gray-400">Not logged in</span>
        )}
      </nav>
    </header>
  );
}
