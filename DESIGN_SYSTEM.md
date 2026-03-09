# Gong Cha Admin — Design System

> **Benchmark:** `TransactionsClient.tsx`
> **Versi:** 1.0.0

---

## File Structure

```
src/
├── lib/
│   └── design-tokens.ts      ← Semua nilai desain (warna, font, spacing, radius)
└── components/
    └── ui/
        ├── index.ts           ← Re-export semua komponen
        └── ui-components.tsx  ← Implementasi komponen
```

---

## Quick Start

```tsx
import { PageWrapper, PageHeader, SyncBadge } from "@/components/ui";
import { C, font } from "@/lib/design-tokens";

export default function MyPage() {
  return (
    <PageWrapper>
      <PageHeader
        title="Members"
        subtitle="100 member terbaru · realtime"
        right={<SyncBadge status="live" count={100} />}
      />
      {/* konten halaman */}
    </PageWrapper>
  );
}
```

---

## Design Tokens

### Typography

| Token | Size | Weight | Pakai untuk |
|---|---|---|---|
| `labelSm` | 11px | 700 | Section header, eyebrow uppercase |
| `labelMd` | 11px | 700 | Kolom tabel header |
| `bodySm` | 12px | 400 | Timestamp, meta info |
| `body` | 13px | 400 | Konten utama, input |
| `bodySb` | 13px | 600 | Nama member, label penting |
| `bodyBold` | 13px | 700 | Nominal, ID |
| `headingSm` | 16px | 700 | Judul modal, sub-section |
| `heading` | 26px | 800 | Judul halaman (H1) |
| `statNum` | 28px | 800 | Angka di summary card |

**Font:** `'Inter', 'SF Pro Display', -apple-system, ...`

---

### Colors

```
Surface:
  C.bg       #F9FAFB   ← latar halaman
  C.white    #FFFFFF   ← latar card / tabel
  C.border   #E5E7EB   ← border universal

Text:
  C.tx1      #111827   ← teks utama
  C.tx2      #6B7280   ← teks sekunder
  C.tx3      #9CA3AF   ← label / placeholder

Brand:
  C.blue     #2563EB   ← link, ID, poin, button primary

Status (tiap status punya: bg, border, color):
  amber  → NEEDS_REVIEW
  green  → COMPLETED
  red    → FRAUD
  orange → FLAGGED
  gray   → REFUNDED
```

---

### Spacing (4px grid)

| Var | Value | Contoh pakai |
|---|---|---|
| `spacing.xs` | 4px | gap ikon dalam button |
| `spacing.sm` | 8px | margin kecil |
| `spacing.md` | 12px | gap toolbar |
| `spacing.lg` | 16px | padding sel tabel |
| `spacing.xl` | 20px | padding toolbar, modal |
| `spacing["2xl"]` | 24px | margin bawah header |
| `spacing["3xl"]` | 28px | padding atas halaman |

---

### Border Radius

| Var | Value | Pakai untuk |
|---|---|---|
| `radius.sm` | 6px | badge kecil |
| `radius.btn` | 7px | button kecil |
| `radius.input` | 9px | input, select |
| `radius.card` | 16px | summary card |
| `radius.table` | 18px | table card shell |
| `radius.modal` | 20px | modal |
| `radius.pill` | 99px | status badge, sync badge |

---

## Components

### `<PageWrapper>`
Shell utama halaman. Selalu bungkus konten halaman dengan ini.

```tsx
<PageWrapper maxWidth={1400}>
  {/* isi halaman */}
</PageWrapper>
```

---

### `<PageHeader>`
Header standar di atas semua halaman.

```tsx
<PageHeader
  eyebrow="Gong Cha Admin"   // optional, default sudah di-set
  title="Members"
  subtitle="100 member terbaru"
  right={<SyncBadge status="live" count={txs.length} />}
/>
```

---

### `<SyncBadge>`
Indikator koneksi realtime Firestore.

```tsx
<SyncBadge status="connecting" />
<SyncBadge status="live" count={42} />
<SyncBadge status="error" />
```

---

### `<SummaryGrid>` + `<SummaryCard>`
Grid 4-kolom untuk summary statistik.

```tsx
<SummaryGrid>
  {summaryItems.map(s => (
    <SummaryCard
      key={s.key}
      label={s.label}
      count={counts[s.key]}
      bg={s.bg} color={s.color} border={s.border}
      active={filter === s.key}
      onClick={() => setFilter(filter === s.key ? "all" : s.key)}
    />
  ))}
</SummaryGrid>
```

---

### `<StatusBadge>`
Chip status untuk kolom tabel.

```tsx
<StatusBadge status="NEEDS_REVIEW" />
<StatusBadge status="COMPLETED" />
<StatusBadge status="FRAUD" />
<StatusBadge status="FLAGGED" />
<StatusBadge status="REFUNDED" />
```

---

### `<TableCard>`
Shell card untuk semua tabel. Termasuk toolbar slot.

```tsx
<TableCard
  toolbar={
    <>
      <SearchInput value={q} onChange={setQ} placeholder="Cari nama…" />
      <FilterSelect value={filter} onChange={setFilter} options={filterOptions} />
      <ToolbarCount count={filtered.length} label="member" />
    </>
  }
>
  <table>
    <thead>
      <tr><Th>Nama</Th><Th>Status</Th></tr>
    </thead>
    <tbody>
      {filtered.map(row => (
        <Tr key={row.id}>
          <Td><MonoCell>{row.id}</MonoCell></Td>
          <Td><StatusBadge status={row.status} /></Td>
        </Tr>
      ))}
      {filtered.length === 0 && <TableEmpty colSpan={2} loading={loading} />}
    </tbody>
  </table>
</TableCard>
```

---

### `<ActionButton>`

```tsx
// Variant: primary | warning | danger | ghost
// Size: sm (default, untuk tabel) | md (untuk modal/form)

<ActionButton variant="warning" size="sm" onClick={() => setVerify(tx)}>
  Tinjau
</ActionButton>

<ActionButton variant="primary" size="md" loading={isLoading} onClick={handleSubmit}>
  Simpan
</ActionButton>

<ActionButton variant="ghost" size="md" onClick={onClose}>
  Batal
</ActionButton>
```

---

### `<Modal>` + `<DetailRow>` + `<ModalActions>`

```tsx
<Modal
  open={!!selectedTx}
  onClose={() => setSelectedTx(null)}
  title="Detail Transaksi"
  width={480}
>
  <DetailRow label="ID Transaksi" value={<MonoCell>{tx.transactionId}</MonoCell>} />
  <DetailRow label="Member" value={tx.memberName} />
  <DetailRow label="Nominal" value={fmtRp(tx.amount)} />
  <DetailRow label="Status" value={<StatusBadge status={tx.status} />} />

  <ModalActions>
    <ActionButton variant="ghost" size="md" onClick={() => setSelectedTx(null)}>Batal</ActionButton>
    <ActionButton variant="danger" size="md" loading={loading} onClick={() => handleReject()}>Tolak</ActionButton>
    <ActionButton variant="primary" size="md" loading={loading} onClick={() => handleApprove()}>Setujui</ActionButton>
  </ModalActions>
</Modal>
```

**Catatan:** Modal otomatis close dengan `Escape` key dan klik di luar overlay.

---

### `<Toast>`

```tsx
{toast && (
  <Toast
    msg={toast.msg}
    type={toast.type}       // "success" | "error"
    duration={3000}         // optional, default 3000ms
    onDone={() => setToast(null)}
  />
)}
```

---

## Aturan Konsistensi (Wajib Diikuti)

### ✅ DO
- Selalu mulai halaman dengan `<PageWrapper>` lalu `<PageHeader>`
- Gunakan `C.tx1 / tx2 / tx3` untuk semua warna teks
- Gunakan `statusConfig` untuk warna status — jangan hardcode amber/green/red sendiri
- Gunakan `<Modal>` + `<DetailRow>` + `<ModalActions>` untuk semua popup detail
- Gunakan `<Toast>` untuk semua feedback aksi (bukan alert/console)
- Gunakan `<ActionButton variant="ghost">` untuk tombol Cancel/Batal
- Gunakan `<MonoCell>` untuk ID, kode unik, transaction ID

### ❌ DON'T
- Jangan hardcode nilai seperti `"#D97706"` atau `fontSize: 11` di luar design tokens
- Jangan buat modal sendiri di luar komponen `<Modal>` — tidak konsisten
- Jangan pakai warna status di luar `statusConfig` / `C.*` tokens
- Jangan buat spinner/loading state sendiri — pakai `loading` prop di `ActionButton`
- Jangan buat container tabel sendiri — pakai `<TableCard>`

---

## Menambah Halaman Baru (Checklist)

```
□ Import PageWrapper, PageHeader dari @/components/ui
□ Import C, spacing, font dari @/lib/design-tokens jika perlu inline style
□ Pakai SyncBadge jika halaman punya realtime listener
□ Pakai SummaryGrid + SummaryCard jika ada statistik ringkasan
□ Pakai TableCard + Th/Td/Tr untuk semua tabel
□ Pakai StatusBadge untuk kolom status
□ Pakai Modal + DetailRow + ModalActions untuk semua dialog
□ Pakai Toast untuk semua notifikasi aksi
```

---

## Saran Pengembangan Lanjutan

1. **Tailwind CSS v4** — migrate dari inline styles ke utility classes dengan token yang sama, lebih mudah dark mode.
2. **`useToast` hook** — abstrak state toast agar tidak perlu `useState` di setiap halaman.
3. **`cn()` utility** — jika migrate ke Tailwind, pakai `clsx` + `twMerge` untuk composable class.
4. **Storybook** — dokumentasi komponen visual interaktif per komponen.
5. **Dark mode** — semua token sudah siap dikonversi ke CSS variables untuk `prefers-color-scheme`.
