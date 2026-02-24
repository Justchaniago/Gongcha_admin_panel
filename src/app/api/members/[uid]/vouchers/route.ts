import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseServer";
import * as admin from "firebase-admin";
import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebaseAdmin";
import { UserVoucher, VoucherType } from "@/types/firestore";
import { v4 as uuidv4 } from "uuid";

// Helper validasi session admin/master
async function validateSession() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;
  if (!sessionCookie) {
    return { error: "Session tidak ditemukan. Silakan login ulang.", status: 403 };
  }
  const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);
  const userRole = decodedClaims.role as string;
  if (!["admin", "master"].includes(userRole)) {
    return { error: "Akses ditolak. Anda tidak memiliki izin.", status: 403 };
  }
  return { token: decodedClaims, userRole, error: null };
}

// POST /api/members/[uid]/vouchers — Suntik voucher ke user
export async function POST(req: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  // Debug log
  // eslint-disable-next-line no-console
  const awaitedParams = await params;
  console.log('API /api/members/[uid]/vouchers params:', awaitedParams);
  const { uid } = awaitedParams;
  if (!uid) {
    // eslint-disable-next-line no-console
    console.error('API /api/members/[uid]/vouchers: UID kosong!', { awaitedParams });
    return NextResponse.json({ message: "UID diperlukan." }, { status: 400 });
  }

  const validation = await validateSession();
  if (validation.error) {
    return NextResponse.json({ message: validation.error }, { status: validation.status });
  }

  try {
    const body = await req.json();
    const { rewardId, title, code, expiresAt } = body;
    if (!rewardId || !title || !code || !expiresAt) {
      return NextResponse.json({ message: "Semua field wajib diisi." }, { status: 400 });
    }
    const voucher: UserVoucher = {
      id: uuidv4(),
      rewardId,
      title,
      code,
      isUsed: false,
      expiresAt,
      type: "personal" as VoucherType,
    };
    const userRef = adminDb.collection("users").doc(uid);
    await userRef.update({ vouchers: admin.firestore.FieldValue.arrayUnion(voucher) });
    return NextResponse.json({ success: true, voucher });
  } catch (err: any) {
    console.error("[POST /api/members/[uid]/vouchers]", err);
    return NextResponse.json({ message: err.message ?? "Internal server error." }, { status: 500 });
  }
}
