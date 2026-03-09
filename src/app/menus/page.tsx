import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminDb, adminAuth } from "@/lib/firebaseAdmin";
import MenusClient from "./MenusClient";
import { ProductItem } from "@/types/firestore";
import UnauthorizedOverlay from "@/components/ui/UnauthorizedOverlay";

export const dynamic = "force-dynamic";

export default async function MenusPage() {
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

  const adminDoc = await adminDb.collection("admin_users").doc(uid).get();
  const profile = adminDoc.data();
  const role = profile?.role;

  // Hanya Super Admin yang boleh mengakses halaman ini
  if (role !== "SUPER_ADMIN") {
    return <UnauthorizedOverlay />;
  }

  // Fetch from collection "products"
  const snapshot = await adminDb.collection("products").get();
  const menus = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as (ProductItem & { id: string })[];

  return (
    <MenusClient initialMenus={menus} />
  );
}