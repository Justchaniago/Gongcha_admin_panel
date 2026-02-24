
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import RewardsClient from "./RewardsClient";
import UnauthorizedOverlay from "@/components/ui/UnauthorizedOverlay";

export const dynamic = "force-dynamic";

export default async function RewardsPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;

  if (!sessionCookie) redirect("/login");

  let uid = "";
  try {
    const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);
    uid = decodedClaims.uid;
  } catch (error) {
    console.error("Session error:", error);
  }

  if (!uid) redirect("/login");

  // Cek Role
  const userDoc = await adminDb.collection("users").doc(uid).get();
  const staffDoc = await adminDb.collection("staff").doc(uid).get();
  const profile = userDoc.exists ? userDoc.data() : staffDoc.exists ? staffDoc.data() : null;
  const role = profile?.role;

  const allowedRoles = ["admin", "master", "manager", "store_manager"];
  if (!allowedRoles.includes(role)) {
    return <UnauthorizedOverlay />;
  }

  // Fetch initial data
  const rewardsSnap = await adminDb.collection("rewards_catalog").orderBy("title").get();
  const initialRewards = rewardsSnap.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      title: data.title || "Untitled Reward",
      pointsCost: data.pointsCost || 0,
      imageURL: data.imageURL || "",
      category: data.category || "General",
      type: data.type || "discount",
      description: data.description || "",
      isActive: data.isActive !== undefined ? data.isActive : true,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
      updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : new Date().toISOString(),
    };
  });

  return (
    <div style={{ padding: "28px 32px", maxWidth: "1200px", margin: "0 auto" }}>
      {/* HEADER SECTION (Server-side) */}
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#0D0F17", fontFamily: "'Instrument Sans', sans-serif", margin: "0 0 6px 0", letterSpacing: "-.02em" }}>
          Voucher & Rewards
        </h1>
        <p style={{ fontSize: "14px", color: "#8C91AC", fontFamily: "'Instrument Sans', sans-serif", margin: 0 }}>
          Kelola katalog hadiah, harga poin, dan ketersediaan voucher untuk member.
        </p>
      </div>

      {/* CLIENT COMPONENT */}
      <RewardsClient initialRewards={initialRewards} />
    </div>
  );
}