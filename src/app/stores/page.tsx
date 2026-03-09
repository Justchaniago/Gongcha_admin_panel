// src/app/dashboard/stores/page.tsx


import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminDb, adminAuth } from "@/lib/firebaseAdmin";
import StoresClient from "./StoresClient";
import { Store } from "@/types/firestore";
import UnauthorizedOverlay from "@/components/ui/UnauthorizedOverlay";

export const dynamic = "force-dynamic";

export default async function StoresPage() {
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

  // Fresh role fetch
  const adminDoc = await adminDb.collection("admin_users").doc(uid).get();
  const profile = adminDoc.data();
  const role = profile?.role;

  // Hanya Super Admin yang boleh mengakses halaman ini
  if (role !== "SUPER_ADMIN") {
    return <UnauthorizedOverlay />;
  }

  const snapshot = await adminDb.collection("stores").get();
  const stores = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as (Store & { id: string })[];

  const activeCount   = stores.filter(s => s.isActive !== false).length;
  const inactiveCount = stores.length - activeCount;

  return (
    <div className="mx-auto max-w-7xl px-4 md:px-8 py-7">

      {/* ── PAGE HEADER / HERO ── */}
      <header className="mb-7">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <div>
            <p className="text-[11px] font-bold tracking-[0.12em] uppercase text-gray-400 mb-1.5">
              Gong Cha Admin
            </p>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-gray-900 leading-tight">
              Store Management
            </h1>
            <p className="text-sm md:text-base text-gray-600 mt-2">
              Manage store information, GPS location, and operational status.
            </p>
          </div>

          <section
            aria-label="Daftar outlet"
            className="w-full lg:max-w-md lg:justify-self-end bg-white border border-gray-100 rounded-2xl shadow-sm p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-800">Outlet List</h2>
              <span className="text-xs text-gray-500">{stores.length} outlet</span>
            </div>

            <ul className="max-h-[400px] overflow-y-auto pr-1 space-y-2">
              {stores.length === 0 ? (
                <li className="text-sm text-gray-500 py-4 text-center">Belum ada outlet</li>
              ) : (
                stores.map((store) => (
                  <li
                    key={store.id}
                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-gray-100 bg-gray-50"
                  >
                    <span className="text-sm font-medium text-gray-700 truncate">
                      {store.name || "Outlet tanpa nama"}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        store.isActive !== false
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {store.isActive !== false ? "Open" : "Closed"}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </section>
        </div>
      </header>

      {/* ── STAT ROW ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Total Stores', value: stores.length,                                              color: '#4361EE', bg: '#EEF2FF', icon: 'store' },
          { label: 'Active',        value: activeCount,                                                color: '#12B76A', bg: '#ECFDF3', icon: 'check' },
          { label: 'Inactive',     value: inactiveCount,                                              color: '#F04438', bg: '#FEF3F2', icon: 'x'     },
          { label: 'With GPS',   value: stores.filter(s => s.latitude && s.longitude).length,       color: '#F79009', bg: '#FFFAEB', icon: 'pin'   },
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
              {s.icon === 'store' && (
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke={s.color} strokeWidth={2}>
                  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
              )}
              {s.icon === 'check' && (
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke={s.color} strokeWidth={2.5}>
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
              )}
              {s.icon === 'x' && (
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke={s.color} strokeWidth={2.5}>
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              )}
              {s.icon === 'pin' && (
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke={s.color} strokeWidth={2}>
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
                </svg>
              )}
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

      {/* ── STORES TABLE (client component) ── */}
      <StoresClient initialStores={stores} />
    </div>
  );
}