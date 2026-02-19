"use client";
import { useState, useEffect } from "react";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { app } from "@/lib/firebaseClient";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

export default function WelcomeLoginPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) router.push("/dashboard");
  }, [user, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const auth = getAuth(app);
      await signInWithEmailAndPassword(auth, email, password);
      // Redirect handled by useEffect
    } catch (err: any) {
      setError(err.message.includes("wrong-password")
        ? "Password salah. Coba lagi."
        : "Login gagal. Cek email dan password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
      <section className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 flex flex-col items-center">
        <h1 className="text-2xl font-bold mb-2 text-blue-700">Gong Cha Admin Panel</h1>
        <p className="mb-6 text-gray-500">Welcome! Please login to continue.</p>
        <form onSubmit={handleLogin} className="w-full flex flex-col gap-4">
          <input
            type="email"
            placeholder="Email"
            className="w-full px-4 py-2 rounded border border-gray-300 focus:border-blue-500 focus:outline-none"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="username"
          />
          <input
            type="password"
            placeholder="Password"
            className="w-full px-4 py-2 rounded border border-gray-300 focus:border-blue-500 focus:outline-none"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          {error && <div className="text-red-600 text-sm">{error}</div>}
          <button
            type="submit"
            className="w-full py-2 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
            disabled={loading}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
      </section>
    </main>
  );
}
