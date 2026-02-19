import { getDashboardData } from '@/lib/dashboardQueries';

function TrendBadge({ value }: { value: number }) {
  const isUp = value >= 0;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: '2px 8px', borderRadius: 99,
      background: isUp ? 'rgba(18,183,106,.14)' : 'rgba(240,68,56,.14)',
      color: isUp ? '#027A48' : '#B42318',
      fontSize: 11, fontWeight: 700,
    }}>
      <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
        {isUp
          ? <path d="M5 8V2M2 5l3-3 3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          : <path d="M5 2v6M2 5l3 3 3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        }
      </svg>
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; dot: string }> = {
    verified: { bg: '#ECFDF3', color: '#027A48', dot: '#12B76A' },
    pending:  { bg: '#FFFAEB', color: '#B54708', dot: '#F79009' },
    rejected: { bg: '#FEF3F2', color: '#B42318', dot: '#F04438' },
  };
  const s = map[status] ?? map.pending;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 99,
      background: s.bg, color: s.color,
      fontSize: 11, fontWeight: 700, letterSpacing: '.04em',
      textTransform: 'uppercase' as const,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.dot }} />
      {status}
    </span>
  );
}

const C = {
  bg:       '#F4F6FB',
  white:    '#FFFFFF',
  border:   '#EAECF2',
  border2:  '#F0F2F7',
  tx1:      '#0F1117',
  tx2:      '#4A5065',
  tx3:      '#9299B0',
  tx4:      '#BCC1D3',
  blue:     '#4361EE',
  blueL:    '#EEF2FF',
  blueD:    '#3A0CA3',
  green:    '#12B76A',
  greenBg:  '#ECFDF3',
  amber:    '#F79009',
  amberBg:  '#FFFAEB',
  red:      '#C8102E',
  shadow:   '0 1px 3px rgba(16,24,40,.06), 0 1px 2px rgba(16,24,40,.04)',
  shadowMd: '0 4px 16px rgba(16,24,40,.08), 0 2px 4px rgba(16,24,40,.04)',
} as const;

const card: React.CSSProperties = {
  background: C.white, border: `1px solid ${C.border}`,
  borderRadius: 18, boxShadow: C.shadow,
};

export default async function DashboardPage() {
  const stats = await getDashboardData();
  const recentTrx = stats.recentTransactions ?? [];

  const now = new Date();
  const hr = now.getHours();
  const greeting = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", WebkitFontSmoothing: 'antialiased' }}>

      {/* ─── TOP BAR ─── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <p style={{ fontSize: 13, color: C.tx3, marginBottom: 4 }}>{dateStr}</p>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-.025em', color: C.tx1, lineHeight: 1.1, margin: 0 }}>
            {greeting}, Admin! 👋
          </h1>
          <p style={{ fontSize: 14, color: C.tx2, marginTop: 5 }}>
            Here's what's happening at Gong Cha today.
          </p>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: C.white, border: `1.5px solid ${C.border}`,
          borderRadius: 10, padding: '8px 16px', boxShadow: C.shadow,
        }}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={C.tx3} strokeWidth={2}>
            <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
          </svg>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.tx1 }}>This month</span>
          <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke={C.tx3} strokeWidth={2.5}>
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </div>
      </div>

      {/* ─── BENTO ROW 1: 4 stat cards ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>

        {/* Hero — Revenue */}
        <div style={{
          ...card,
          background: `linear-gradient(135deg, ${C.blue} 0%, ${C.blueD} 100%)`,
          border: 'none', padding: '24px 26px',
          transition: 'transform .18s, box-shadow .18s',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.65)' }}>
              Total Revenue
            </span>
            <div style={{
              width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,.18)',
              border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
                <path d="M7 17L17 7M17 7H7M17 7v10"/>
              </svg>
            </div>
          </div>
          <p style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-.025em', color: '#fff', lineHeight: 1, marginBottom: 14 }}>
            Rp {stats.totalRevenue.toLocaleString('id-ID')}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              padding: '2px 9px', borderRadius: 99, fontSize: 11, fontWeight: 700,
              background: 'rgba(18,183,106,.22)', color: '#6EE7B7',
            }}>
              ↑ 2.6%
            </span>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,.55)' }}>vs. last month</span>
          </div>
        </div>

        {/* Active Members */}
        {[
          {
            label: 'Active Members', value: stats.totalMembers.toLocaleString(),
            trend: 5.1, trendLabel: 'vs. last month',
            iconBg: C.blueL, iconColor: C.blue,
            icon: <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>,
          },
          {
            label: 'Total Stores', value: String(stats.totalStores),
            trend: 0, trendLabel: 'All active',
            iconBg: '#F3F0FF', iconColor: '#7C3AED',
            icon: <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>,
          },
          {
            label: 'Pending Claims', value: String(stats.pendingCount),
            trend: -stats.pendingCount, trendLabel: 'Needs review',
            iconBg: '#FEF3F2', iconColor: '#F04438',
            borderOverride: stats.pendingCount > 0 ? '1.5px solid #FEE2E2' : undefined,
            icon: <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>,
          },
        ].map((s, i) => (
          <div key={i} style={{
            ...card,
            border: (s as any).borderOverride ?? card.border,
            padding: '22px 24px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: C.tx3 }}>
                {s.label}
              </span>
              <div style={{
                width: 32, height: 32, borderRadius: 9, background: s.iconBg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke={s.iconColor} strokeWidth={2}>
                  {s.icon}
                </svg>
              </div>
            </div>
            <p style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-.025em', color: C.tx1, lineHeight: 1, marginBottom: 10 }}>
              {s.value}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <TrendBadge value={s.trend} />
              <span style={{ fontSize: 11.5, color: C.tx3 }}>{s.trendLabel}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ─── BENTO ROW 2: 3 mini cards ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
        {[
          {
            label: 'Total XP Issued', iconBg: C.blueL, iconColor: C.blue,
            value: `${((stats.totalMembers ?? 0) * 1240).toLocaleString('id-ID')} pts`,
            icon: <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>,
          },
          {
            label: 'Verified Trx (recent)', iconBg: C.greenBg, iconColor: C.green,
            value: `${recentTrx.filter(t => t.status === 'verified').length} / ${recentTrx.length}`,
            icon: <path d="M20 6L9 17l-5-5"/>,
          },
          {
            label: 'Avg. Transaction', iconBg: C.amberBg, iconColor: C.amber,
            value: `Rp ${recentTrx.length > 0 ? Math.round(recentTrx.reduce((a, t) => a + t.amount, 0) / recentTrx.length).toLocaleString('id-ID') : '0'}`,
            icon: <><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></>,
          },
        ].map((s, i) => (
          <div key={i} style={{ ...card, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 46, height: 46, borderRadius: 13, background: s.iconBg,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke={s.iconColor} strokeWidth={2}>
                {s.icon}
              </svg>
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: C.tx3, marginBottom: 5 }}>
                {s.label}
              </p>
              <p style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-.02em', color: C.tx1, lineHeight: 1 }}>
                {s.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* ─── BOTTOM: Table + Sidebar ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 310px', gap: 14 }}>

        {/* Transactions table */}
        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '20px 24px 16px', borderBottom: `1px solid ${C.border2}`,
          }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: C.tx3, marginBottom: 3 }}>
                Activity
              </p>
              <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-.01em', color: C.tx1, margin: 0 }}>
                Recent Transactions
              </h2>
            </div>
            <a href="/dashboard/transactions" style={{
              fontSize: 13, fontWeight: 600, color: C.blue,
              textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '7px 14px', borderRadius: 8,
              border: `1.5px solid ${C.blueL}`, background: C.blueL,
            }}>
              View all
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path d="M7 17L17 7M17 7H7M17 7v10"/>
              </svg>
            </a>
          </div>

          {recentTrx.length === 0 ? (
            <div style={{ padding: '52px 24px', textAlign: 'center', color: C.tx3, fontSize: 13.5 }}>
              Belum ada transaksi.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8F9FC' }}>
                  {['Transaction ID', 'Member', 'Amount', 'Status', 'Date'].map(h => (
                    <th key={h} style={{
                      padding: '10px 20px', textAlign: 'left',
                      fontSize: 11, fontWeight: 700, letterSpacing: '.08em',
                      textTransform: 'uppercase', color: C.tx3,
                      borderBottom: `1px solid ${C.border2}`,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentTrx.map((trx, i) => (
                  <tr key={trx.transactionId} style={{
                    borderBottom: i < recentTrx.length - 1 ? `1px solid ${C.border2}` : 'none',
                  }}>
                    <td style={{ padding: '14px 20px' }}>
                      <code style={{
                        fontSize: 12, background: C.blueL, padding: '3px 9px',
                        borderRadius: 6, color: C.blue, fontFamily: 'monospace',
                        border: `1px solid rgba(67,97,238,.15)`,
                      }}>
                        {trx.transactionId}
                      </code>
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: 13.5, fontWeight: 600, color: C.tx1 }}>
                      {trx.memberName}
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: 14, fontWeight: 700, color: C.tx1 }}>
                      Rp {trx.amount.toLocaleString('id-ID')}
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <StatusBadge status={trx.status} />
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: 12.5, color: C.tx3 }}>
                      {trx.createdAt
                        ? new Date(trx.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div style={{
            padding: '12px 24px', borderTop: `1px solid ${C.border2}`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: 12, color: C.tx3 }}>
              Showing <strong style={{ color: C.tx2 }}>{recentTrx.length}</strong> most recent
            </span>
          </div>
        </div>

        {/* Right sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Top Stores */}
          <div style={{ ...card, padding: '20px 22px' }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: C.tx3, marginBottom: 3 }}>
              Performa
            </p>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: C.tx1, marginBottom: 18, letterSpacing: '-.01em' }}>
              Top Stores
            </h2>
            {[
              { name: 'Grand Indonesia', pct: 87, color: C.blue },
              { name: 'Pondok Indah Mall', pct: 64, color: '#7C3AED' },
              { name: 'Central Park', pct: 51, color: C.green },
              { name: 'Senayan City', pct: 38, color: C.amber },
            ].map((s, i) => (
              <div key={i} style={{ marginBottom: i < 3 ? 14 : 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: C.tx1 }}>{s.name}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: s.color }}>{s.pct}%</span>
                </div>
                <div style={{ height: 5, borderRadius: 99, background: C.border2 }}>
                  <div style={{ height: '100%', borderRadius: 99, width: `${s.pct}%`, background: s.color }} />
                </div>
              </div>
            ))}
          </div>

          {/* Tier Breakdown */}
          <div style={{ ...card, padding: '20px 22px' }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: C.tx3, marginBottom: 3 }}>
              Members
            </p>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: C.tx1, marginBottom: 16, letterSpacing: '-.01em' }}>
              Tier Breakdown
            </h2>
            {[
              { label: 'Platinum', color: '#5B21B6', bg: '#F3F0FF', ring: '#DDD6FE', pct: 8 },
              { label: 'Gold',     color: '#92400E', bg: '#FFFBEB', ring: '#FDE68A', pct: 22 },
              { label: 'Silver',   color: '#475569', bg: '#F8FAFC', ring: '#E2E8F0', pct: 70 },
            ].map((t, i) => {
              const count = Math.round(stats.totalMembers * t.pct / 100);
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '9px 13px', borderRadius: 10,
                  background: t.bg, border: `1px solid ${t.ring}`,
                  marginBottom: i < 2 ? 8 : 0,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: t.color }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: t.color }}>{t.label}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: t.color }}>{count.toLocaleString()}</span>
                    <span style={{ fontSize: 10.5, color: t.color, opacity: .6, marginLeft: 4 }}>{t.pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </div>
    </div>
  );
}