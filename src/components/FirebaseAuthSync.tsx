"use client";
// src/components/FirebaseAuthSync.tsx
// Sync NextAuth session with Firebase Auth client
// This ensures Firestore client SDK has proper authentication

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { getAuth, signInWithCustomToken, signOut } from "firebase/auth";
import { app } from "../lib/firebaseClient";

export default function FirebaseAuthSync() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "authenticated" && session?.user?.email) {
      // User is logged in via NextAuth
      // We need to also sign in to Firebase Auth
      const syncFirebaseAuth = async () => {
        try {
          const auth = getAuth(app);
          
          // Check if already signed in to Firebase
          if (auth.currentUser) {
            // Already signed in, check if same user
            if (auth.currentUser.email === session.user.email) {
              return; // Already synced
            }
            // Different user, sign out first
            await signOut(auth);
          }
          
          // Get custom token from API
          const res = await fetch("/api/auth/firebase-token");
          if (res.ok) {
            const { token } = await res.json();
            if (token) {
              await signInWithCustomToken(auth, token);
              console.log("✅ Firebase Auth synced");
            }
          }
        } catch (err) {
          console.error("Firebase Auth sync error:", err);
        }
      };
      
      syncFirebaseAuth();
    } else if (status === "unauthenticated") {
      // Sign out from Firebase when NextAuth session ends
      const auth = getAuth(app);
      if (auth.currentUser) {
        signOut(auth).catch(console.error);
      }
    }
  }, [session, status]);

  return null; // This component doesn't render anything
}
