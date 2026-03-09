import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import NotificationsClient from "./NotificationsClient";
import UnauthorizedOverlay from "@/components/ui/UnauthorizedOverlay";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;
  if (!sessionCookie) redirect("/login");

  let uid = "";
  let role = "";
  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    uid  = decoded.uid;
    role = (decoded.role as string) ?? "";
  } catch {
    redirect("/login");
  }

  const adminProfileSnap = await adminDb.collection("admin_users").doc(uid).get();
  const adminProfile = adminProfileSnap.data();
  role = role || adminProfile?.role || "";

  if (adminProfile?.isActive !== true || !["SUPER_ADMIN", "STAFF"].includes(role)) {
    return <UnauthorizedOverlay />;
  }

  // Fetch initial notification log (most recent 50)
  const logsSnap = await adminDb
    .collection("notifications_log")
    .orderBy("sentAt", "desc")
    .limit(50)
    .get();

  const initialLogs = logsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // Fetch members for targeting dropdown
  const usersSnap = await adminDb.collection("users").get();
  const members = usersSnap.docs.map((d) => {
    const data = d.data();
    return { uid: d.id, name: data.name ?? "", email: data.phone ?? "" };
  });

  return (
    <NotificationsClient
      initialRole={role}
      initialLogs={initialLogs as any[]}
      members={members}
    />
  );
}
