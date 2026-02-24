import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminDb, adminAuth } from "@/lib/firebaseAdmin";
import TransactionsClient from "./TransactionsClient";

export const dynamic = "force-dynamic";

export default async function TransactionsPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;
  if (!sessionCookie) redirect("/login");

  let uid = "";
  try {
    const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);
    uid = decodedClaims.uid;
  } catch (error) {
    redirect("/login");
  }

  // Role check (reuse allowedRoles from users-staff)
  const userDoc = await adminDb.collection("users").doc(uid).get();
  const staffDoc = await adminDb.collection("staff").doc(uid).get();
  const profile = userDoc.exists ? userDoc.data() : staffDoc.exists ? staffDoc.data() : null;
  const role = profile?.role;
  // Kasir juga boleh akses transaksi
  // const allowedRoles = ["admin", "master", "manager", "store_manager"];
  // if (!allowedRoles.includes(role)) redirect("/unauthorized");

  // Fetch transactions (limit 50, order by createdAt desc)
  const txSnap = await adminDb.collection("transactions").orderBy("createdAt", "desc").limit(50).get();
  const initialTransactions = txSnap.docs.map(d => {
    const data = d.data() || {};
    return {
      docId: d.id,
      docPath: data.docPath ?? "",
      transactionId: data.transactionId ?? "",
      memberName: data.memberName ?? "",
      memberId: data.memberId ?? "",
      staffId: data.staffId ?? "",
      storeLocation: data.storeLocation ?? "",
      amount: data.amount ?? 0,
      potentialPoints: data.potentialPoints ?? 0,
      status: data.status ?? "pending",
      createdAt: data.createdAt ? (typeof data.createdAt.toDate === "function" ? data.createdAt.toDate().toISOString() : String(data.createdAt)) : null,
      verifiedAt: data.verifiedAt ? (typeof data.verifiedAt.toDate === "function" ? data.verifiedAt.toDate().toISOString() : data.verifiedAt) : null,
      verifiedBy: data.verifiedBy ?? null,
    };
  });

  return <TransactionsClient initialTransactions={initialTransactions} />;
}
