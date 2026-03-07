/**
 * scripts/unifyTransactionStatuses.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Migration script: Unify semua status transaksi lama ke canonical uppercase schema.
 *
 * Mapping:
 *   "pending"   → "NEEDS_REVIEW"
 *   "PENDING"   → "NEEDS_REVIEW"
 *   "verified"  → "COMPLETED"
 *   "completed" → "COMPLETED"   (lowercase typo)
 *   "rejected"  → "FRAUD"
 *
 * Status yang TIDAK diubah (sudah canonical):
 *   "NEEDS_REVIEW", "COMPLETED", "FRAUD", "FLAGGED", "REFUNDED"
 *
 * Usage:
 *   node scripts/unifyTransactionStatuses.js            ← live migration
 *   node scripts/unifyTransactionStatuses.js --dry-run  ← preview tanpa commit
 *
 * ⚠️  Jalankan SATU KALI setelah go-live.
 * ⚠️  Pastikan sudah backup Firestore sebelum menjalankan script ini.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const admin        = require("firebase-admin");
const serviceAccount = require("../serviceAccountKey.json");

// ── Config ─────────────────────────────────────────────────────────────────
const DRY_RUN    = process.argv.includes("--dry-run");
const BATCH_SIZE = 450;
const DB_ID      = process.env.FIRESTORE_DATABASE_ID || "gongcha-ver001";

const STATUS_MAP = {
  "pending":   "NEEDS_REVIEW",
  "PENDING":   "NEEDS_REVIEW",
  "verified":  "COMPLETED",
  "completed": "COMPLETED",
  "rejected":  "FRAUD",
};

const CANONICAL = new Set(["NEEDS_REVIEW", "COMPLETED", "FRAUD", "FLAGGED", "REFUNDED"]);

// ── Init ────────────────────────────────────────────────────────────────────
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId:  serviceAccount.project_id,
});

const db = admin.firestore();
db.settings({ databaseId: DB_ID });

// ── Main ────────────────────────────────────────────────────────────────────
async function migrateStatuses() {
  const t0 = Date.now();

  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║         Gong Cha — Transaction Status Migration              ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log(`\n  Database : ${DB_ID}`);
  console.log(`  Mode     : ${DRY_RUN ? "🔍 DRY RUN (tidak ada yang berubah)" : "🔥 LIVE — perubahan akan disimpan ke Firestore"}`);
  console.log(`  Mapping  :`);
  Object.entries(STATUS_MAP).forEach(([f, t]) => console.log(`    "${f}" → "${t}"`));
  console.log();

  if (!DRY_RUN) {
    console.log("  ⚠️  Memulai dalam 3 detik... tekan Ctrl+C untuk batalkan.\n");
    await new Promise(r => setTimeout(r, 3000));
  }

  // 1. Fetch semua transaksi (collectionGroup — tersimpan sebagai subcollection stores/{id}/transactions)
  console.log("⏳ Mengambil dokumen via collectionGroup('transactions')...");
  const snap = await db.collectionGroup("transactions").get();
  console.log(`✅ ${snap.size} dokumen ditemukan.\n`);

  // 2. Analisis
  const statusCount = {};
  const toMigrate   = [];
  const alreadyOk   = [];
  const unknown     = [];

  snap.docs.forEach(doc => {
    const s = doc.data().status;
    statusCount[s] = (statusCount[s] ?? 0) + 1;
    if (STATUS_MAP[s])   toMigrate.push({ ref: doc.ref, from: s, to: STATUS_MAP[s] });
    else if (CANONICAL.has(s)) alreadyOk.push(doc.id);
    else unknown.push({ id: doc.id, status: s });
  });

  // 3. Tabel distribusi status
  console.log("📊 Distribusi Status Saat Ini:");
  console.log("  ┌──────────────────┬─────────┬──────────────────────┐");
  console.log("  │ Status           │ Jumlah  │ Aksi                 │");
  console.log("  ├──────────────────┼─────────┼──────────────────────┤");
  Object.entries(statusCount).sort().forEach(([s, n]) => {
    const aksi = STATUS_MAP[s]
      ? `→ "${STATUS_MAP[s]}"`
      : CANONICAL.has(s) ? "✅ Sudah canonical" : "⚠️  Unknown";
    console.log(`  │ ${s.padEnd(16)} │ ${String(n).padStart(7)} │ ${aksi.padEnd(20)} │`);
  });
  console.log("  └──────────────────┴─────────┴──────────────────────┘\n");

  if (unknown.length > 0) {
    console.log(`⚠️  ${unknown.length} dokumen dengan status TIDAK DIKENAL (akan di-skip):`);
    unknown.slice(0, 5).forEach(u => console.log(`   - ${u.id}: "${u.status}"`));
    if (unknown.length > 5) console.log(`   ... dan ${unknown.length - 5} lainnya`);
    console.log();
  }

  if (toMigrate.length === 0) {
    console.log("🎉 Tidak ada yang perlu dimigrasikan. Semua status sudah canonical!\n");
    console.log(`   ✅ Canonical : ${alreadyOk.length} docs`);
    console.log(`   ⚠️  Unknown   : ${unknown.length} docs`);
    process.exit(0);
  }

  console.log(`📦 Perlu dimigrasikan : ${toMigrate.length} docs`);
  console.log(`📦 Sudah canonical    : ${alreadyOk.length} docs`);
  if (unknown.length) console.log(`📦 Unknown (skip)     : ${unknown.length} docs`);
  console.log();

  // 4. Batch update
  const totalBatches = Math.ceil(toMigrate.length / BATCH_SIZE);
  let migrated = 0;

  for (let i = 0; i < toMigrate.length; i += BATCH_SIZE) {
    const chunk = toMigrate.slice(i, i + BATCH_SIZE);
    const label = `Batch ${Math.floor(i / BATCH_SIZE) + 1}/${totalBatches}`;

    if (DRY_RUN) {
      console.log(`  🔍 [DRY RUN] ${label}: ${chunk.length} docs AKAN diubah`);
      chunk.slice(0, 3).forEach(c => console.log(`     - ${c.ref.id}: "${c.from}" → "${c.to}"`));
      if (chunk.length > 3) console.log(`     ... dan ${chunk.length - 3} lainnya`);
    } else {
      process.stdout.write(`  ⏳ ${label}: ${chunk.length} docs... `);
      const batch = db.batch();
      chunk.forEach(({ ref, to }) => {
        batch.update(ref, {
          status:     to,
          migratedAt: new Date().toISOString(),
          migratedBy: "unifyTransactionStatuses.js",
        });
      });
      await batch.commit();
      migrated += chunk.length;
      console.log("✅");
    }
  }

  // 5. Verifikasi (live only)
  if (!DRY_RUN) {
    console.log("\n🔍 Verifikasi pasca-migration...");
    const verify  = await db.collectionGroup("transactions").get();
    const remain  = verify.docs.filter(d => STATUS_MAP[d.data().status]);
    if (remain.length > 0) {
      console.log(`⚠️  Masih ada ${remain.length} docs dengan status lama. Jalankan ulang script ini.`);
    } else {
      console.log("✅ Semua status sudah canonical. Tidak ada sisa data lama.");
    }
  }

  // 6. Summary
  const dur = ((Date.now() - t0) / 1000).toFixed(1);
  console.log();
  console.log("╔══════════════════════════════════════════════════════════════╗");
  if (DRY_RUN) {
    console.log("║  DRY RUN SELESAI — Tidak ada perubahan yang dilakukan.       ║");
    console.log(`║  ${toMigrate.length} docs AKAN dimigrasikan jika dijalankan tanpa --dry-run.     ║`.slice(0, 65) + "║");
    console.log("╠══════════════════════════════════════════════════════════════╣");
    console.log("║  Untuk jalankan migration sungguhan:                         ║");
    console.log("║    node scripts/unifyTransactionStatuses.js                  ║");
  } else {
    console.log("║  ✅ MIGRATION SELESAI                                         ║");
    console.log(`║  Migrated : ${String(migrated).padEnd(51)}║`);
    console.log(`║  Skipped  : ${String(alreadyOk.length).padEnd(51)}║`);
    console.log(`║  Duration : ${(dur + "s").padEnd(51)}║`);
  }
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  process.exit(0);
}

migrateStatuses().catch(err => {
  console.error("\n❌ MIGRATION GAGAL:", err.message);
  console.error("\n   Kemungkinan penyebab:");
  console.error("   1. serviceAccountKey.json tidak ditemukan atau tidak valid");
  console.error(`   2. FIRESTORE_DATABASE_ID salah (saat ini: "${DB_ID}")`);
  console.error("   3. Koneksi internet terputus");
  console.error("   4. Permission Firestore tidak mencukupi\n");
  process.exit(1);
});
