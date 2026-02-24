import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { adminDb, adminAuth } from "@/lib/firebaseServer";

export const authOptions: NextAuthOptions = {
  // Gunakan JWT strategy — tidak perlu database adapter
  session: {
    strategy: "jwt",
    maxAge:   60 * 60 * 8, // 8 jam
  },

  // cookies config dihapus, NextAuth akan handle otomatis

  pages: {
    signIn: "/login", // redirect ke halaman login custom kamu
  },

  providers: [
    CredentialsProvider({
      name: "Email & Password",
      credentials: {
        email:    { label: "Email",    type: "email"    },
        password: { label: "Password", type: "password" },
      },

      async authorize(credentials) {
        if (!credentials) {
          throw new Error("No credentials provided.");
        }
        console.log("credentials masuk:", credentials);
        // 1. Verifikasi email+password via Firebase Auth REST API
        const firebaseApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY!;
        const res = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseApiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email:             credentials.email,
              password:          credentials.password,
              returnSecureToken: true,
            }),
          }
        );

        const firebaseUser = await res.json();
        console.log("user dari Firebase Auth:", firebaseUser);

        if (!res.ok || firebaseUser.error) {
          const code = firebaseUser.error?.message ?? "";
          if (
            code.includes("INVALID_PASSWORD") ||
            code.includes("EMAIL_NOT_FOUND") ||
            code.includes("INVALID_LOGIN_CREDENTIALS")
          ) throw new Error("Email atau password salah.");
          if (code.includes("USER_DISABLED")) throw new Error("Akun ini telah dinonaktifkan.");
          throw new Error("Login gagal. Coba lagi.");
        }

        const uid   = firebaseUser.localId as string;
        const email = firebaseUser.email   as string;

        // 2. Cek koleksi staff dulu
        const staffDoc = await adminDb.collection("staff").doc(uid).get();
        console.log("staffDoc.exists:", staffDoc.exists, staffDoc.data());
        if (staffDoc.exists) {
          const staffData = staffDoc.data()!;

          if (staffData.isActive === false) {
            throw new Error("Akun staff ini telah dinonaktifkan.");
          }

          return {
            id:            uid,
            uid:           uid,
            email,
            name:          staffData.name          ?? email,
            role:          staffData.role          ?? "cashier",
            storeLocation: staffData.storeLocation ?? null, // ← field store
          };
        }

        // 3. Cek koleksi users (admin)
        const userDoc = await adminDb.collection("users").doc(uid).get();
        console.log("userDoc.exists:", userDoc.exists, userDoc.data());
        if (userDoc.exists) {
          const userData = userDoc.data()!;
          return {
            id:            uid,
            uid:           uid,
            email,
            name:          userData.name  ?? email,
            role:          userData.role  ?? "member",
            storeLocation: null, // admin tidak punya store assignment
          };
        }

        throw new Error("Akun tidak ditemukan. Hubungi administrator.");
      },
    }),
  ],

  callbacks: {
    // Simpan uid dan role ke JWT token
    async jwt({ token, user }) {
      if (user) {
        token.uid  = user.uid;
        token.role = user.role;
      }
      return token;
    },

    // Expose uid dan role ke session (bisa diakses di server & client)
    async session({ session, token }) {
      session.user.uid  = token.uid;
      session.user.role = token.role;
      return session;
    },
  },

  debug: process.env.NODE_ENV === "development",
};