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

  const userDoc = await adminDb.collection("users").doc(uid).get();
  const staffDoc = await adminDb.collection("staff").doc(uid).get();
  const profile = userDoc.exists ? userDoc.data() : staffDoc.exists ? staffDoc.data() : null;
  const role = profile?.role;

  const allowedRoles = ["admin", "master", "manager"];
  if (!allowedRoles.includes(role?.toLowerCase?.() || role)) {
    return <UnauthorizedOverlay />;
  }

  // Fetch dari collection "products"
  const snapshot = await adminDb.collection("products").get();
  const menus = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as (ProductItem & { id: string })[];

  const availableCount = menus.filter(m => m.isAvailable !== false).length;
  const unavailableCount = menus.length - availableCount;

  return (
    <div style={{
      padding: '28px 32px', maxWidth: 1400,
      fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      WebkitFontSmoothing: 'antialiased',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#9299B0', marginBottom: 5 }}>
            Gong Cha Admin
          </p>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-.025em', color: '#0F1117', lineHeight: 1.1, margin: 0 }}>
            Product Management
          </h1>
          <p style={{ fontSize: 14, color: '#4A5065', marginTop: 5 }}>
            Kelola daftar minuman, harga, dan ketersediaan di Showcase Menu App.
          </p>
        </div>
        <MenusClient initialMenus={menus} showAddTrigger />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Total Produk', value: menus.length, color: '#4361EE', bg: '#EEF2FF', icon: 'menu' },
          { label: 'Tersedia', value: availableCount, color: '#12B76A', bg: '#ECFDF3', icon: 'check' },
          { label: 'Kosong/Nonaktif', value: unavailableCount, color: '#F04438', bg: '#FEF3F2', icon: 'x' },
        ].map((s) => (
          <div key={s.label} style={{
            background: '#fff', border: '1px solid #EAECF2',
            borderRadius: 18, boxShadow: '0 1px 3px rgba(16,24,40,.06)',
            padding: '20px 22px', display: 'flex', alignItems: 'center', gap: 16,
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: s.bg, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
               <span style={{ fontSize: 20, color: s.color, fontWeight: 'bold' }}>#</span>
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9299B0', marginBottom: 5 }}>
                {s.label}
              </p>
              <p style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.02em', color: s.color, lineHeight: 1 }}>
                {s.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      <MenusClient initialMenus={menus} />
    </div>
  );
}