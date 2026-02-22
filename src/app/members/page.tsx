// app/dashboard/members/page.tsx
// Server component — SSR initial data + real session via NextAuth
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { adminDb } from "@/lib/firebaseServer";
import { User, Staff } from "@/types/firestore";
import { redirect } from "next/navigation";
import MembersClient from "./MembersClient";

async function getData() {
  const [usersSnap, staffSnap, storesSnap] = await Promise.all([
    adminDb.collection("users").limit(50).get(),
    adminDb.collection("staff").get(),
    adminDb.collection("stores").get(),
  ]);
  return {
    users:    usersSnap.docs.map(d => ({ uid: d.id, ...d.data() } as User  & { uid: string })),
    staff:    staffSnap.docs.map(d => ({ uid: d.id, ...d.data() } as Staff & { uid: string })),
    storeIds: storesSnap.docs.map(d => d.id),
  };
}

export default async function UsersStaffPage() {
  // Ambil session dari NextAuth — null jika belum login
  const session = await getServerSession(authOptions);

  // Redirect ke login jika belum autentikasi
  if (!session) {
    redirect("/login");
  }

  // Hanya staff dan admin yang boleh akses halaman ini
  const allowedRoles = ["admin", "cashier", "store_manager"];
  if (!allowedRoles.includes(session.user.role)) {
    redirect("/unauthorized");
  }

  let users:    (User  & { uid: string })[] = [];
  let staff:    (Staff & { uid: string })[] = [];
  let storeIds: string[] = [];

  try {
    const d = await getData();
    users    = d.users;
    staff    = d.staff;
    storeIds = d.storeIds;
  } catch (err) {
    console.error("Failed to fetch members data:", err);
    // Tetap render — client akan hydrate via onSnapshot jika ada
  }

  return (
    <MembersClient
      initialUsers={users}
      initialStaff={staff}
      storeIds={storeIds}
      currentUserRole={session.user.role}
    />
  );
}