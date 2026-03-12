require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

const BASE_URL = process.env.AUTH_TEST_BASE_URL || "http://localhost:3000";
const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const EMAIL = process.env.AUTH_TEST_EMAIL || "chaniago@gongcha-id.app";
const PASSWORD = process.env.AUTH_TEST_PASSWORD || "abcd1234";

const PAGES = [
  "/dashboard",
  "/stores",
  "/transactions",
  "/rewards",
  "/admin-users",
  "/settings",
  "/menus",
  "/notifications",
];

async function request(path, options = {}) {
  const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;
  const res = await fetch(url, {
    redirect: "manual",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  return {
    status: res.status,
    headers: res.headers,
    body: await res.text(),
  };
}

async function getIdToken() {
  if (!API_KEY) {
    throw new Error("NEXT_PUBLIC_FIREBASE_API_KEY is missing.");
  }

  const res = await request(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method: "POST",
      body: JSON.stringify({
        email: EMAIL,
        password: PASSWORD,
        returnSecureToken: true,
      }),
    }
  );

  if (res.status !== 200) {
    throw new Error(`Firebase sign-in failed: ${res.body}`);
  }

  return JSON.parse(res.body).idToken;
}

async function getSessionCookie() {
  const idToken = await getIdToken();
  const sessionRes = await request("/api/auth/session", {
    method: "POST",
    body: JSON.stringify({ idToken }),
  });

  if (sessionRes.status !== 200) {
    throw new Error(`Session API failed: ${sessionRes.body}`);
  }

  const cookie = sessionRes.headers.get("set-cookie");
  if (!cookie) {
    throw new Error("Session cookie missing from response.");
  }

  return cookie;
}

async function run() {
  console.log("=== Full Auth + Route Smoke Test ===\n");

  console.log("1. Creating authenticated session...");
  const sessionCookie = await getSessionCookie();
  console.log("   session -> OK");

  console.log("\n2. Checking authenticated session endpoint...");
  const authRes = await request("/api/auth/session", {
    headers: { Cookie: sessionCookie },
  });
  console.log(`   /api/auth/session -> HTTP ${authRes.status}`);
  console.log(`   body -> ${authRes.body}`);

  console.log("\n3. Checking protected pages...");
  for (const page of PAGES) {
    const res = await request(page, {
      headers: { Cookie: sessionCookie },
    });
    const redirectedTo = res.headers.get("location");
    const ok = res.status === 200 && !redirectedTo;
    console.log(`   ${ok ? "OK " : "ERR"} ${page} -> HTTP ${res.status}${redirectedTo ? ` -> ${redirectedTo}` : ""}`);
  }

  console.log("\n4. Logging out...");
  const logout = await request("/api/auth/logout", {
    method: "POST",
    headers: { Cookie: sessionCookie },
  });
  console.log(`   /api/auth/logout -> HTTP ${logout.status}`);

  console.log("\n5. Confirming guest redirect after logout...");
  const guestDashboard = await request("/dashboard");
  console.log(`   /dashboard -> HTTP ${guestDashboard.status}`);
  console.log(`   location -> ${guestDashboard.headers.get("location") || "-"}`);
}

run().catch((error) => {
  console.error("\nTest failed:");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
