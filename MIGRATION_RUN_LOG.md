# Gong Cha Admin Panel — Migration Run Log
**Tanggal:** 8 Maret 2026
**Branch:** feature/gemini-summary-export
**Commit Script:** `8c01c65`

---

## Hasil Dry-Run: `node scripts/unifyTransactionStatuses.js --dry-run`

```
╔══════════════════════════════════════════════════════════════╗
║         Gong Cha — Transaction Status Migration              ║
╚══════════════════════════════════════════════════════════════╝

  Database : gongcha-ver001
  Mode     : 🔍 DRY RUN (tidak ada yang berubah)
  Mapping  :
    "pending"   → "NEEDS_REVIEW"
    "PENDING"   → "NEEDS_REVIEW"
    "verified"  → "COMPLETED"
    "completed" → "COMPLETED"
    "rejected"  → "FRAUD"

⏳ Mengambil dokumen via collectionGroup('transactions')...
✅ 0 dokumen ditemukan.

📊 Distribusi Status Saat Ini:
  ┌──────────────────┬─────────┬──────────────────────┐
  │ Status           │ Jumlah  │ Aksi                 │
  ├──────────────────┼─────────┼──────────────────────┤
  └──────────────────┴─────────┴──────────────────────┘

🎉 Tidak ada yang perlu dimigrasikan. Semua status sudah canonical!

   ✅ Canonical : 0 docs
   ⚠️  Unknown   : 0 docs
```

**Interpretasi:** Database `gongcha-ver001` belum memiliki data transaksi (kosong / belum di-seed).
Script sudah siap — jalankan ulang setelah ada data live di production.

---

## Cara Pakai Script (Kapan Pun Diperlukan)

```bash
# 1. Preview dulu (aman, tidak mengubah data)
node scripts/unifyTransactionStatuses.js --dry-run

# 2. Jika dry-run terlihat benar, jalankan migration sungguhan
node scripts/unifyTransactionStatuses.js
```

### Output yang Diharapkan (jika ada data lama):

```
╔══════════════════════════════════════════════════════════════╗
║         Gong Cha — Transaction Status Migration              ║
╚══════════════════════════════════════════════════════════════╝

  Database : gongcha-ver001
  Mode     : 🔥 LIVE — perubahan akan disimpan ke Firestore

  ⚠️  Memulai dalam 3 detik... tekan Ctrl+C untuk batalkan.

⏳ Mengambil dokumen via collectionGroup('transactions')...
✅ 42 dokumen ditemukan.

📊 Distribusi Status Saat Ini:
  ┌──────────────────┬─────────┬──────────────────────┐
  │ Status           │ Jumlah  │ Aksi                 │
  ├──────────────────┼─────────┼──────────────────────┤
  │ COMPLETED        │      15 │ ✅ Sudah canonical    │
  │ NEEDS_REVIEW     │       3 │ ✅ Sudah canonical    │
  │ pending          │       8 │ → "NEEDS_REVIEW"     │
  │ rejected         │       4 │ → "FRAUD"            │
  │ verified         │      12 │ → "COMPLETED"        │
  └──────────────────┴─────────┴──────────────────────┘

📦 Perlu dimigrasikan : 24 docs
📦 Sudah canonical    : 18 docs

🔄 Memproses 1 batch...
  ⏳ Batch 1/1: 24 docs... ✅

🔍 Verifikasi pasca-migration...
✅ Semua status sudah canonical. Tidak ada sisa data lama.

╔══════════════════════════════════════════════════════════════╗
║  ✅ MIGRATION SELESAI                                         ║
║  Migrated : 24                                               ║
║  Skipped  : 18                                               ║
║  Duration : 2.3s                                             ║
╚══════════════════════════════════════════════════════════════╝
```

---

## ⚠️ Script Lama yang Harus Diarsip (Berbahaya)

Script-script berikut **membalik arah migration** dan harus di-rename atau dihapus
sebelum ada yang tidak sengaja menjalankannya di production:

| Script | Masalah | Aksi |
|--------|---------|------|
| `scripts/updateCompletedToVerified.js` | Mengubah `COMPLETED → verified` (arah terbalik!) | **Rename ke `.bak`** |
| `scripts/updateCompletedToVerified.ts` | Sama seperti di atas | **Rename ke `.bak`** |
| `scripts/addTestRejected.js` | Menulis `status: "rejected"` (lowercase lama) | **Hapus dari production** |

```bash
# Arsip script berbahaya (jalankan sekali)
mv scripts/updateCompletedToVerified.js scripts/updateCompletedToVerified.js.bak
mv scripts/updateCompletedToVerified.ts scripts/updateCompletedToVerified.ts.bak
mv scripts/addTestRejected.js scripts/addTestRejected.js.bak
```

---

## Commit History (Semua Fix)

| Commit | Deskripsi |
|--------|-----------|
| `7b19b7f` | `fix(gap-closure): standardize all routes to admin_users, fix status schema, add query limits` |
| `1a29e9a` | `fix(gap-11-10-12): unify status schema across PATCH handler, dashboard filter, and seed data` |
| `8c01c65` | `feat(scripts): add unifyTransactionStatuses.js migration script for legacy status data` |

---

*Migration script tersimpan di `scripts/unifyTransactionStatuses.js`.*
*Jalankan ulang `--dry-run` setelah database production diisi data untuk memverifikasi.*
