import { adminDb } from "@/lib/firebaseAdmin";
import { getAdminSession } from "@/lib/adminSession";
import { authorize } from "@/lib/rbac";
import { User, AdminUser } from "@/types/firestore";
import MembersClient from "./MembersClient";

async function getData() {
  const session = await getAdminSession();
  await authorize(session, { permission: "member.read" });

  const [usersSnap, staffSnap] = await Promise.all([
    adminDb.collection("users").limit(50).get(),
    adminDb.collection("admin_users").get(),
  ]);
  const users = usersSnap.docs.map(d => ({ ...d.data(), uid: d.id } as User & { uid: string }));
  const staff = staffSnap.docs.map(d => ({ ...d.data(), uid: d.id } as AdminUser & { uid: string }));
  return { users, staff };
}

export default async function UsersStaffPage() {
  let users: (User & { uid: string })[] = [];
  let staff: (AdminUser & { uid: string })[] = [];
  try {
    const d = await getData();
    users = d.users;
    staff = d.staff;
  } catch { /* firebase not configured or unauthorized */ }

  return (
    <MembersClient
      initialUsers={Array.isArray(users) ? users : []}
      initialStaff={Array.isArray(staff) ? staff : []}
    />
  );
}
