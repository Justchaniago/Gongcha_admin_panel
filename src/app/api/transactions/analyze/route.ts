import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, isAdminAuthError } from "@/lib/adminSession";
import { authorize, isRbacForbiddenError } from "@/lib/rbac";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession({ allowedRoles: ["SUPER_ADMIN", "ADMIN", "STAFF"] });
    authorize(session, { permission: "transaction.verify" });

    const { receiptDb, receiptPos, amountDb, amountPos, dateDb, datePos } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

    const prompt = `Kamu adalah ahli rekonsiliasi transaksi untuk sistem kasir bubble tea.

Analisis apakah dua record berikut kemungkinan merupakan transaksi yang SAMA dengan kesalahan input:

Data dari aplikasi kasir (DB):
- No. Receipt: "${receiptDb}"
- Nominal: Rp ${amountDb}
- Tanggal: ${dateDb}

Data dari CSV POS:
- No. Receipt: "${receiptPos}"
- Nominal: Rp ${amountPos}
- Tanggal: ${datePos}

Identifikasi jenis mismatch dan apakah terlihat seperti typo manusia (beda 1 digit, angka 0 kurang/lebih, tanggal beda 1 hari, urutan huruf/angka terbalik) atau mismatch nyata (transaksi berbeda sama sekali).

Balas HANYA dengan JSON valid, tanpa markdown:
{
  "confidence": <angka 0-100, 100 = pasti sama>,
  "likelyMatch": <true/false>,
  "reasoning": "<1-2 kalimat penjelasan dalam Bahasa Indonesia>",
  "issues": ["<issue spesifik 1>", "<issue spesifik 2>"]
}`;

    const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 512, temperature: 0.1 },
      }),
    });

    if (!response.ok) throw new Error(`Gemini error: ${response.status}`);

    const gemini = await response.json();
    const raw = gemini.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Invalid Gemini response");

    const result = JSON.parse(jsonMatch[0]);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[transactions/analyze]", err);
    if (isAdminAuthError(err)) return NextResponse.json({ message: err.message }, { status: err.status });
    if (isRbacForbiddenError(err)) return NextResponse.json({ message: err.message, code: err.code }, { status: err.status });
    return NextResponse.json({ message: err.message ?? "Failed to analyze" }, { status: 500 });
  }
}
