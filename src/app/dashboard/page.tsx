import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import DashboardClient from "./DashboardClient";

// Opt-out dari caching static agar data selalu fresh tiap kali halaman dibuka
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
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
    redirect("/login");
  }

  // Ambil profil user untuk mengecek role
  const userDoc = await adminDb.collection("users").doc(uid).get();
  const staffDoc = await adminDb.collection("staff").doc(uid).get();
  
  const profile = userDoc.exists ? userDoc.data() : staffDoc.exists ? staffDoc.data() : null;
  const role = profile?.role || "cashier"; // Default fallback

  // Tarik data awal (Initial Data) secara paralel agar cepat
  const [transactionsSnap, usersSnap, staffSnap] = await Promise.all([
    adminDb.collection("transactions").orderBy("createdAt", "desc").limit(50).get(),
    adminDb.collection("users").get(),
    adminDb.collection("staff").get()
  ]);

  const initialTransactions = transactionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  const initialUsers = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  const initialStaff = staffSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  return (
    <DashboardClient 
      initialRole={role}
      initialTransactions={initialTransactions}
      initialUsers={initialUsers}
      initialStaff={initialStaff}
    />
  );
}