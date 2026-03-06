import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { redirect } from "next/navigation";
import DashboardClient from "./DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get("session")?.value;

  if (!sessionCookie) {
    redirect("/login");
  }

  try {
    // 1. Verifikasi Sesi Kuki
    const decodedToken = await adminAuth.verifySessionCookie(sessionCookie, true);
    const uid = decodedToken.uid;

    // 2. Ambil Profil dari Koleksi Baru (admin_users)
    const adminDoc = await adminDb.collection("admin_users").doc(uid).get();
    
    if (!adminDoc.exists) {
      redirect("/unauthorized");
    }

    const profile = adminDoc.data();
    const role = profile?.role; // 'SUPER_ADMIN' atau 'STAFF'
    const storeId = profile?.storeId;

    if (!profile?.isActive) {
      redirect("/login");
    }

    // 3. Tarik Data Berdasarkan Kasta (Role)
    let transactionsSnap;
    let storesSnap;

    if (role === "SUPER_ADMIN") {
      // Super Admin: Tarik 50 transaksi terakhir dari SEMUA toko
      transactionsSnap = await adminDb
        .collection("transactions")
        .orderBy("timestamp", "desc")
        .limit(50)
        .get();
        
      // Super Admin: Tarik semua daftar toko
      storesSnap = await adminDb.collection("stores").get();
      
    } else if (role === "STAFF" && storeId) {
      // Staff: Tarik 50 transaksi HANYA dari tokonya sendiri
      transactionsSnap = await adminDb
        .collection("transactions")
        .where("storeId", "==", storeId)
        .orderBy("timestamp", "desc")
        .limit(50)
        .get();
        
      // Staff: Tarik data tokonya sendiri saja
      storesSnap = await adminDb
        .collection("stores")
        .where("code", "==", storeId)
        .get();
    } else {
      // Jika Staff tapi tidak punya storeId (Data Korup), tendang!
      redirect("/unauthorized");
    }

    // 4. Serialisasi Data (Mengubah Timestamp Firebase agar ramah Next.js Client)
    const initialTransactions = transactionsSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        // Konversi Timestamp ke milliseconds (angka) agar tidak error di Next.js
        timestamp: data.timestamp?.toMillis() || Date.now(), 
      };
    });

    const initialStores = storesSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return (
      <DashboardClient 
        profile={JSON.parse(JSON.stringify(profile))} // Pastikan aman untuk Client Component
        initialTransactions={initialTransactions} 
        stores={initialStores} 
      />
    );
    
  } catch (error) {
    console.error("[Dashboard] Session validation error:", error);
    redirect("/login");
  }
}