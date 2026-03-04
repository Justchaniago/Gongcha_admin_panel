import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import DashboardClient from "./DashboardClient";

// Opt-out of static caching so data is always fresh every time the page opens
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;

    if (!sessionCookie) {
      redirect("/login");
    }

    let uid = "";
    try {
      const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);
      uid = decodedClaims.uid;
    } catch (error) {
      console.error("[Dashboard] Session verify error:", error);
      redirect("/login");
    }

    // Get user profile to check role
    let userDoc, staffDoc, profile, role;
    try {
      userDoc = await adminDb.collection("users").doc(uid).get();
      staffDoc = await adminDb.collection("staff").doc(uid).get();
      
      profile = userDoc.exists ? userDoc.data() : staffDoc.exists ? staffDoc.data() : null;
      role = profile?.role || "cashier"; // Default fallback
    } catch (error) {
      console.error("[Dashboard] Profile fetch error:", error);
      role = "cashier";
    }

    // Tarik data awal (Initial Data) secara paralel agar cepat
    let initialTransactions: any[] = [], initialUsers: any[] = [], initialStores: any[] = [];
    try {
      const [transactionsSnap, usersSnap, storesSnap] = await Promise.all([
        adminDb.collection("transactions").orderBy("createdAt", "desc").limit(50).get(),
        adminDb.collection("users").get(),
        adminDb.collection("stores").get() // Fetch stores, not staff
      ]);

      initialTransactions = transactionsSnap.docs.map(doc => {
        const data = doc.data();
        const createdAt = data?.createdAt;
        const type = data?.type ?? "earn"; // Default to earn (purchase) if not specified
        return {
          id: doc.id,
          docId: doc.id,
          transactionId: data?.posTransactionId ?? data?.transactionId ?? "",
          memberName: data?.memberName ?? data?.userName ?? "—",
          amount: data?.amount ?? data?.totalAmount ?? 0,
          potentialPoints: data?.potentialPoints ?? 0,
          type: type,
          status: data?.status ?? "pending",
          createdAt: createdAt ? (typeof createdAt.toDate === 'function' ? createdAt.toDate().toISOString() : createdAt) : null,
          storeId: data?.storeId ?? ""
        };
      });
      initialUsers = usersSnap.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          uid: doc.id,
          ...data,
          // Convert any Timestamp fields to ISO strings
          createdAt: data?.createdAt ? (typeof data.createdAt.toDate === 'function' ? data.createdAt.toDate().toISOString() : data.createdAt) : null,
          updatedAt: data?.updatedAt ? (typeof data.updatedAt.toDate === 'function' ? data.updatedAt.toDate().toISOString() : data.updatedAt) : null,
        };
      });
      initialStores = storesSnap.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          uid: doc.id,
          ...data,
          // Convert any Timestamp fields to ISO strings
          createdAt: data?.createdAt ? (typeof data.createdAt.toDate === 'function' ? data.createdAt.toDate().toISOString() : data.createdAt) : null,
          updatedAt: data?.updatedAt ? (typeof data.updatedAt.toDate === 'function' ? data.updatedAt.toDate().toISOString() : data.updatedAt) : null,
        };
      });
    } catch (error) {
      console.error("[Dashboard] Data fetch error:", error);
      // Return with empty data instead of crashing
    }

    return (
      <DashboardClient 
        initialRole={role}
        initialTransactions={initialTransactions}
        initialUsers={initialUsers}
        initialStores={initialStores}
      />
    );
  } catch (error) {
    console.error("[Dashboard] Critical error:", error);
    // Throw the error so Next.js can handle it with error.tsx
    throw error;
  }
}