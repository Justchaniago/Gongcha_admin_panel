"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebaseClient';
import { UserStaff } from '@/types/firestore';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserStaff | null;
  loading: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  logout: () => Promise<void>; // <-- Fungsi ini yang hilang sebelumnya
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  isStaff: false,
  logout: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserStaff | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        try {
          const docRef = doc(db, 'admin_users', firebaseUser.uid);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            setProfile({ uid: docSnap.id, ...docSnap.data() } as UserStaff);
          } else {
            setProfile(null);
          }
        } catch (error) {
          console.error("Error fetching admin profile:", error);
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Fungsi Logout untuk menghapus sesi Firebase dan Cookie Next.js
  const logout = async () => {
    try {
      await signOut(auth); // Hapus sesi Firebase Client
      await fetch('/api/auth/logout', { method: 'POST' }); // Hapus Cookie Next.js
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const isAdmin = profile?.role === 'SUPER_ADMIN';
  const isStaff = profile?.role === 'STAFF';

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, isStaff, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);