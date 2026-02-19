// app/dashboard/members/page.tsx
// Server component — provides SSR initial data, then client takes over with realtime
import { adminDb } from "@/lib/firebaseServer";
import { User, Staff } from "@/types/firestore";
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
  let users:    (User  & { uid: string })[] = [];
  let staff:    (Staff & { uid: string })[] = [];
  let storeIds: string[] = [];

  try {
    const d = await getData();
    users    = d.users;
    staff    = d.staff;
    storeIds = d.storeIds;
  } catch {
    // Firebase not configured — client will hydrate from onSnapshot
  }

  return (
    <MembersClient
      initialUsers={users}
      initialStaff={staff}
      storeIds={storeIds}
    />
  );
}