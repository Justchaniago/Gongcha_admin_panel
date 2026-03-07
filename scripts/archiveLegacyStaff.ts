/**
 * scripts/archiveLegacyStaff.ts
 *
 * Safe Purge — Fase 7: Archive Legacy Staff Collection
 * ─────────────────────────────────────────────────────
 * Menyalin setiap dokumen dari koleksi "staff" ke "staff_archive",
 * lalu menghapus dokumen aslinya. Batch di-commit per 450 operasi
 * agar tidak melampaui batas 500 operasi per batch Firestore.
 *
 * Jalankan:
 *   npx ts-node --project tsconfig.seed.json scripts/archiveLegacyStaff.ts
 */

import { adminDb } from "../src/lib/firebaseAdmin";

const BATCH_SIZE = 450; // max Firestore batch = 500 ops; 2 ops per doc → 450 docs per commit

async function archiveLegacyStaff(): Promise<void> {
  console.log("🔍  Mengambil semua dokumen dari koleksi 'staff'...");

  const staffSnapshot = await adminDb.collection("staff").get();

  if (staffSnapshot.empty) {
    console.log("✅  Koleksi 'staff' sudah kosong. Tidak ada yang perlu diarsipkan.");
    return;
  }

  const total = staffSnapshot.size;
  console.log(`📦  Ditemukan ${total} dokumen. Memulai proses arsip...\n`);

  const docs = staffSnapshot.docs;
  let archivedCount = 0;
  let batchIndex = 0;

  // Proses dalam kelompok BATCH_SIZE dokumen
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const chunk = docs.slice(i, i + BATCH_SIZE);
    const batch = adminDb.batch();

    for (const doc of chunk) {
      const archiveRef = adminDb.collection("staff_archive").doc(doc.id);
      const staffRef   = adminDb.collection("staff").doc(doc.id);

      // Salin data + tambahkan metadata arsip
      batch.set(archiveRef, {
        ...doc.data(),
        _archivedAt:     new Date().toISOString(),
        _archivedReason: "Fase 7 Safe Purge — migrated to admin_users",
        _originalId:     doc.id,
      });

      // Tandai dokumen asli untuk dihapus
      batch.delete(staffRef);
    }

    await batch.commit();
    batchIndex++;
    archivedCount += chunk.length;
    console.log(`  ✔  Batch ${batchIndex}: ${chunk.length} dokumen diarsipkan (total: ${archivedCount}/${total})`);
  }

  console.log(`\n✅  Berhasil memindahkan ${archivedCount} data staf ke arsip dan membersihkan koleksi lama.`);
  console.log(`    Koleksi tujuan : staff_archive`);
  console.log(`    Koleksi sumber : staff (sekarang kosong)`);
}

archiveLegacyStaff()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌  Error saat proses arsip:", err);
    process.exit(1);
  });
