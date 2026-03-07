import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminDb, adminAuth } from "@/lib/firebaseAdmin";
import TransactionsClient from "./TransactionsClient";
import UnauthorizedOverlay from "@/components/ui/UnauthorizedOverlay";

export const dynamic = "force-dynamic";

export default async function TransactionsPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;
  if (!sessionCookie) redirect("/login");

  let uid = "";
  try {
    const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);
    uid = decodedClaims.uid;
  } catch {
    redirect("/login");
  }

  // Pilar 1: Validasi Role dari admin_users
  const adminDoc = await adminDb.collection("admin_users").doc(uid).get();
  const profile  = adminDoc.data();
  const role     = profile?.role ?? "";

  if (role !== "SUPER_ADMIN") {
    return <UnauthorizedOverlay />;
  }

  // Data diambil realtime oleh Client Component (onSnapshot)
  return <TransactionsClient initialRole={role} />;
}
