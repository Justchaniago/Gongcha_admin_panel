// src/app/api/setup-user/route.ts
// GET: Check if user exists in staff/users collection
// POST: Register authenticated user to staff collection

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { adminDb } from "../../../lib/firebaseServer";

export async function GET(req: NextRequest) {
  try {
    const token = await getToken({ req });
    if (!token?.sub) {
      return NextResponse.json(
        { error: "Unauthorized - No session found" },
        { status: 401 }
      );
    }

    const userId = token.sub;
    const email = token.email || "";

    // Check if user exists in staff collection
    const staffDoc = await adminDb.collection("staff").doc(userId).get();
    const userDoc = await adminDb.collection("users").doc(userId).get();

    const exists = staffDoc.exists || userDoc.exists;

    return NextResponse.json({
      exists,
      userId,
      email,
      inStaff: staffDoc.exists,
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

export async function POST(req: NextRequest) {
  try {
    const token = await getToken({ req });
    if (!token?.sub) {
      return NextResponse.json(
        { error: "Unauthorized - No session found" },
        { status: 401 }
      );
    }

    const userId = token.sub;
    const email = token.email || "";
    const name = token.name || email.split("@")[0];

    // Check if user already exists
    const staffDoc = await adminDb.collection("staff").doc(userId).get();
    if (staffDoc.exists) {
      return NextResponse.json({
        success: true,
        message: "User already exists in staff collection",
        userId,
        email
      });
    }

    // Add user to staff collection
    await adminDb.collection("staff").doc(userId).set({
      uid: userId,
      email,
      name,
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date()
    });

    return NextResponse.json({
      success: true,
      message: "User successfully registered to staff collection",
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
