
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import MembersClient from "./MembersClient";
import UnauthorizedOverlay from "@/components/ui/UnauthorizedOverlay";

export const dynamic = "force-dynamic";

export default async function UsersStaffPage() {
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

  // Otorisasi via admin_users schema baru
  const adminSnap = await adminDb.collection("admin_users").doc(uid).get();
  const profile = adminSnap.data();
  const role = profile?.role;

  if (profile?.isActive !== true || !["SUPER_ADMIN", "STAFF"].includes(role)) {
    return <UnauthorizedOverlay />;
  }

  // Tarik data Users, Admin Users, dan Stores secara paralel
  const [usersSnap, staffSnap, storesSnap] = await Promise.all([
    adminDb.collection("users").orderBy("name").get(),
    adminDb.collection("admin_users").orderBy("name").get(),
    adminDb.collection("stores").get()
  ]);

  const initialUsers = usersSnap.docs.map(d => {
    const data = d.data() || {};
    return {
      uid: d.id,
      name: data.name ?? "",
      phoneNumber: data.phoneNumber ?? "",
      email: data.email ?? "",
      photoURL: data.photoURL ?? "",
      role: data.role ?? "member",
      tier: data.tier ?? "Silver",
      currentPoints: data.currentPoints ?? 0,
      lifetimePoints: data.lifetimePoints ?? 0,
      joinedDate: data.joinedDate ?? "",
      xpHistory: data.xpHistory ?? [],
      vouchers: data.vouchers ?? [],
    };
  });
  const initialStaff = staffSnap.docs.map(d => {
    const data = d.data() || {};
    return {
      uid: d.id,
      name: data.name ?? "",
      email: data.email ?? "",
      role: data.role ?? "STAFF",
      assignedStoreId: data.assignedStoreId ?? null,
      isActive: data.isActive ?? true,
    };
  });
  const storeIds = storesSnap.docs.map(d => d.id);

  return (
    <MembersClient
      initialUsers={initialUsers}
      initialStaff={initialStaff}
      storeIds={storeIds}
    />
  );
}