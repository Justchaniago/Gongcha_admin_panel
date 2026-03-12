require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

const BASE_URL = process.env.AUTH_TEST_BASE_URL || "http://localhost:3000";
const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const EMAIL = process.env.AUTH_TEST_EMAIL || "chaniago@gongcha-id.app";
const PASSWORD = process.env.AUTH_TEST_PASSWORD || "abcd1234";

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

async function signInWithPassword() {
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

  return JSON.parse(res.body);
}

async function run() {
  console.log("=== Auth Smoke Test ===\n");

  console.log("1. Checking public routes...");
  const loginPage = await request("/login");
  console.log(`   /login -> HTTP ${loginPage.status}`);

  const guestDashboard = await request("/dashboard");
  console.log(`   /dashboard without session -> HTTP ${guestDashboard.status}`);
  console.log(`   location -> ${guestDashboard.headers.get("location") || "-"}`);

  console.log("\n2. Signing in with Firebase REST API...");
  const authData = await signInWithPassword();
  console.log(`   uid -> ${authData.localId}`);
  console.log("   idToken -> OK");

  console.log("\n3. Creating app session cookie...");
  const sessionRes = await request("/api/auth/session", {
    method: "POST",
    body: JSON.stringify({ idToken: authData.idToken }),
  });

  console.log(`   /api/auth/session -> HTTP ${sessionRes.status}`);
  if (sessionRes.status !== 200) {
    throw new Error(`Session API failed: ${sessionRes.body}`);
  }

  const sessionCookie = sessionRes.headers.get("set-cookie");
  if (!sessionCookie) {
    throw new Error("Session cookie missing from response.");
  }
  console.log("   set-cookie -> OK");

  console.log("\n4. Verifying authenticated endpoints...");
  const authCheck = await request("/api/auth/session", {
    headers: { Cookie: sessionCookie },
  });
  console.log(`   GET /api/auth/session -> HTTP ${authCheck.status}`);
  console.log(`   body -> ${authCheck.body}`);

  const dashboard = await request("/dashboard", {
    headers: { Cookie: sessionCookie },
  });
  console.log(`   GET /dashboard with session -> HTTP ${dashboard.status}`);
  console.log(`   location -> ${dashboard.headers.get("location") || "-"}`);

  console.log("\n5. Logging out...");
  const logout = await request("/api/auth/logout", {
    method: "POST",
    headers: { Cookie: sessionCookie },
  });
  console.log(`   POST /api/auth/logout -> HTTP ${logout.status}`);
}

run().catch((error) => {
  console.error("\nTest failed:");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
