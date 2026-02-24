// src/app/api/auth/firebase-token/route.ts
// Generate Firebase custom token for client-side Firestore access

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { adminAuth } from "../../../../lib/firebaseAdmin";

export async function GET(req: NextRequest) {
  try {
    // Get NextAuth session
    const token = await getToken({ req });
    
    if (!token?.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const uid = token.sub;

    // Generate Firebase custom token
    const customToken = await adminAuth.createCustomToken(uid);

    return NextResponse.json({ token: customToken });
    
  } catch (error) {
    console.error("Firebase token generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate token" },
      { status: 500 }
    );
  }
}
