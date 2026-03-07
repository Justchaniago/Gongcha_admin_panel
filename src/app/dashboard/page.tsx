import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import DashboardClient from "./DashboardClient";

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

  const adminDoc = await adminDb.collection("admin_users").doc(uid).get();
  
  if (!adminDoc.exists) {
    redirect("/login");
  }

  const profileData = adminDoc.data();
  const role = profileData?.role || "STAFF";

  // FIX: Lempar array kosong untuk memuaskan TypeScript. 
  // DashboardClient akan otomatis mengambil data asli secara realtime via useEffect.
  return (
    <DashboardClient 
      initialRole={role} 
      initialTransactions={[]}
      initialUsers={[]}
      initialStores={[]}
    />
  );
}