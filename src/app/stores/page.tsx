import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import StoresClient from './StoresClient';
import { Store } from '@/types/firestore';

export default async function StoresPage() {
  const snapshot = await getDocs(collection(db, 'stores'));
  const stores = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as (Store & { id: string })[];

  const activeCount   = stores.filter(s => s.isActive !== false).length;
  const inactiveCount = stores.length - activeCount;

  return (
    <div style={{
      padding: '28px 32px', maxWidth: 1400,
      fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      WebkitFontSmoothing: 'antialiased',
    }}>

      {/* ── PAGE HEADER ── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#9299B0', marginBottom: 5 }}>
            Gong Cha Admin
          </p>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-.025em', color: '#0F1117', lineHeight: 1.1, margin: 0 }}>
            Store Management
          </h1>
          <p style={{ fontSize: 14, color: '#4A5065', marginTop: 5 }}>
            Kelola informasi outlet, lokasi GPS, dan status operasional.
          </p>
        </div>
        {/* Button rendered di client agar bisa trigger modal */}
        <StoresClient initialStores={stores} showAddTrigger />
      </div>

      {/* ── STAT ROW ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Total Outlet',   value: stores.length,  color: '#4361EE', bg: '#EEF2FF', icon: 'store' },
          { label: 'Aktif',          value: activeCount,    color: '#12B76A', bg: '#ECFDF3', icon: 'check' },
          { label: 'Nonaktif',       value: inactiveCount,  color: '#F04438', bg: '#FEF3F2', icon: 'x' },
          { label: 'Dengan GPS',     value: stores.filter(s => s.latitude && s.longitude).length, color: '#F79009', bg: '#FFFAEB', icon: 'pin' },
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