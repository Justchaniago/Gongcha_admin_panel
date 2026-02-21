// src/app/accounts/page.tsx
// Server Component — SSR initial data, then AccountsClient takes over with real-time listener

import { adminDb } from "@/lib/firebaseServer";
import { Account } from "@/types/firestore";
import AccountsClient from "./AccountsClient";

async function getAccounts(): Promise<Account[]> {
  const snap = await adminDb
    .collection("accounts")
    .orderBy("createdAt", "desc")
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Account));
}

export default async function AccountsPage() {
  let initialAccounts: Account[] = [];

  try {
    initialAccounts = await getAccounts();
  } catch {
    // Firebase Admin not yet configured — client hydrates from onSnapshot
  }

  return <AccountsClient initialAccounts={initialAccounts} />;
}