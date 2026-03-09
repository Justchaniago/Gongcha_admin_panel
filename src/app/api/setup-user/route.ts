// src/app/api/setup-user/route.ts
// GET: Check if user exists in admin_users/users collections
// POST: Register authenticated user to admin_users collection

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;
    if (!sessionCookie) {
      return NextResponse.json(
        { error: "Unauthorized - No session found" },
        { status: 401 }
      );
    }
    const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);
    const userId = decodedClaims.uid;
    const email = decodedClaims.email || "";

    // Check if user exists in admin_users collection
    const adminUserDoc = await adminDb.collection("admin_users").doc(userId).get();
    const userDoc = await adminDb.collection("users").doc(userId).get();

    const exists = adminUserDoc.exists || userDoc.exists;

    return NextResponse.json({
      exists,
      userId,
      email,
      inAdminUsers: adminUserDoc.exists,
      inUsers: userDoc.exists,
      message: exists ? "User is registered" : "User is not registered"
    });
  } catch (error) {
    console.error("Error checking user registration:", error);
    return NextResponse.json(
      { error: "Failed to check registration status" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;
    if (!sessionCookie) {
      return NextResponse.json(
        { error: "Unauthorized - No session found" },
        { status: 401 }
      );
    }
    const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);
    const userId = decodedClaims.uid;
    const email = decodedClaims.email || "";
    const name = decodedClaims.name || email.split("@")[0];

    // Check if user already exists
    const adminUserDoc = await adminDb.collection("admin_users").doc(userId).get();
    if (adminUserDoc.exists) {
      return NextResponse.json({
        success: true,
        message: "User already exists in admin_users collection",
        userId,
        email
      });
    }

    // Add user to admin_users collection
    await adminDb.collection("admin_users").doc(userId).set({
      uid: userId,
      email,
      name,
      role: "STAFF",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    return NextResponse.json({
      success: true,
      message: "User successfully registered to admin_users collection",
      userId,
      email
    });

  } catch (error) {
    console.error("Error setting up user:", error);
    return NextResponse.json(
      { error: "Failed to setup user" },
      { status: 500 }
    );
  }
}
