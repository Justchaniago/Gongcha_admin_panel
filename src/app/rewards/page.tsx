
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import RewardsClient from "./RewardsClient";
import UnauthorizedOverlay from "@/components/ui/UnauthorizedOverlay";
import { Reward, rewardConverter } from "@/types/firestore";

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

  const adminSnap = await adminDb.collection("admin_users").doc(uid).get();
  const profile = adminSnap.data();
  const role = profile?.role;
  if (profile?.isActive !== true || !["SUPER_ADMIN", "STAFF"].includes(role)) {
    return <UnauthorizedOverlay />;
  }

  // Fetch initial data
  const rewardsSnap = await adminDb.collection("rewards").withConverter(rewardConverter as any).orderBy("title").get();
  const initialRewards = rewardsSnap.docs.map(doc => {
    const data = doc.data() as Reward;
    return { ...data, id: doc.id };
  });

  return (
    <div style={{ padding: "28px 32px", maxWidth: "1200px", margin: "0 auto" }}>
      {/* HEADER SECTION (Server-side) */}
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#0D0F17", fontFamily: "'Instrument Sans', sans-serif", margin: "0 0 6px 0", letterSpacing: "-.02em" }}>
          Voucher & Rewards
        </h1>
        <p style={{ fontSize: "14px", color: "#8C91AC", fontFamily: "'Instrument Sans', sans-serif", margin: 0 }}>
          Manage reward catalog, points pricing, and voucher availability for members.
        </p>
      </div>

      {/* CLIENT COMPONENT */}
      <RewardsClient initialRewards={initialRewards} />
    </div>
  );
}