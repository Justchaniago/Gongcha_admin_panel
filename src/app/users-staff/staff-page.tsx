import { adminDb } from "@/lib/firebaseServer";
import { Staff } from "@/types/firestore";
import UsersStaffClient from "./UsersStaffClient";

async function getData() {
  const [staffSnap, storesSnap] = await Promise.all([
    adminDb.collection("staff").get(),
    adminDb.collection("stores").get(),
  ]);

  const staff = staffSnap.docs.map(d => ({ uid: d.id, ...d.data() } as Staff & { uid: string }));
  const storeIds = storesSnap.docs.map(d => d.id);

  return { staff, storeIds };
}

export default async function StaffPage() {
  let staff: (Staff & { uid: string })[] = [];
  let storeIds: string[] = [];

  try {
    const d = await getData();
    staff = d.staff;
    storeIds = d.storeIds;
  } catch {}

  return (
    <UsersStaffClient
      initialStaff={staff}
      storeIds={storeIds}
    />
  );
}
