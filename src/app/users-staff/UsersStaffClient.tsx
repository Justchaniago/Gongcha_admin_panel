import { adminDb } from "@/lib/firebaseServer";
import { User, Staff } from "@/types/firestore";
import MembersClient from "./MembersClient";

async function getData() {
  const [usersSnap, staffSnap, storesSnap] = await Promise.all([
    adminDb.collection("users").limit(50).get(),
    adminDb.collection("staff").get(),
    adminDb.collection("stores").get(),
  ]);
  const users    = usersSnap.docs.map(d => ({ uid: d.id, ...d.data() } as User  & { uid: string }));
  const staff    = staffSnap.docs.map(d => ({ uid: d.id, ...d.data() } as Staff & { uid: string }));
  const storeIds = storesSnap.docs.map(d => d.id);
  return { users, staff, storeIds };
}

export default async function UsersStaffPage() {
  let users:    (User  & { uid: string })[] = [];
  let staff:    (Staff & { uid: string })[] = [];
  let storeIds: string[] = [];
  try {
    const d = await getData();
    users    = d.users;
    staff    = d.staff;
    storeIds = d.storeIds;
  } catch { /* firebase not configured */ }

  return (
    <MembersClient
      initialUsers={Array.isArray(users)    ? users    : []}
      initialStaff={Array.isArray(staff)    ? staff    : []}
      storeIds={Array.isArray(storeIds) ? storeIds : []}
    />
  );
}