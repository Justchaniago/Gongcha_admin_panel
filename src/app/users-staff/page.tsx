
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

  // Tarik profil user untuk otorisasi dasar
  const adminDoc = await adminDb.collection("admin_users").doc(uid).get();
  const profile = adminDoc.data();
  const role = profile?.role;

  // Hanya Super Admin yang boleh mengakses halaman ini
  if (role !== "SUPER_ADMIN") {
    return <UnauthorizedOverlay />;
  }

  // Tarik data Users, Staff, dan Stores secara paralel
  const [usersSnap, staffSnap, storesSnap] = await Promise.all([
    adminDb.collection("users").orderBy("name").get(),
    adminDb.collection("staff").orderBy("name").get(),
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
      role: data.role ?? "cashier",
      isActive: data.isActive ?? true,
      storeLocations: data.storeLocations ?? [],
      accessAllStores: data.accessAllStores ?? false,
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