import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, isAdminAuthError } from "@/lib/adminSession";

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent";

const PROMPTS = {
  notification: (context: string) => `
Kamu adalah marketing copywriter untuk Gong Cha, brand bubble tea premium di Indonesia.
Buat 3 variasi push notification dalam Bahasa Indonesia berdasarkan konteks berikut: "${context}"

Ketentuan:
- Judul (title): max 60 karakter, catchy, action-oriented
- Isi (body): max 180 karakter, ringkas, engaging
- Tone: ramah tapi profesional, sesuai brand Gong Cha yang premium
- Gunakan bahasa sehari-hari yang natural, bukan bahasa formal kaku
- Boleh pakai emoji jika relevan

Kembalikan HANYA JSON valid, tanpa markdown, tanpa penjelasan:
[{"title":"...","body":"..."},{"title":"...","body":"..."},{"title":"...","body":"..."}]
`.trim(),

  menu_description: (entityName: string, context: string) => `
Kamu adalah copywriter untuk Gong Cha, brand bubble tea premium di Indonesia.
Buat 3 variasi deskripsi produk untuk menu "${entityName}"${context ? ` dengan konteks: ${context}` : ""}.

Ketentuan:
- 1-2 kalimat, max 150 karakter per deskripsi
- Tonjolkan rasa, bahan, dan daya tariknya
- Tone: hangat, appetizing, premium
- Bahasa Indonesia yang natural

Kembalikan HANYA JSON valid, tanpa markdown, tanpa penjelasan:
["deskripsi 1","deskripsi 2","deskripsi 3"]
`.trim(),

  reward_description: (entityName: string, context: string) => `
Kamu adalah copywriter untuk Gong Cha, brand bubble tea premium di Indonesia.
Buat 3 variasi deskripsi reward/voucher untuk "${entityName}"${context ? ` dengan konteks: ${context}` : ""}.

Ketentuan:
- 1-2 kalimat, max 150 karakter per deskripsi
- Tonjolkan nilai reward, keuntungan member, dan cara redeem
- Tone: exciting, menggiurkan, premium — buat member ingin segera tukar poin
- Bahasa Indonesia yang natural

Kembalikan HANYA JSON valid, tanpa markdown, tanpa penjelasan:
["deskripsi 1","deskripsi 2","deskripsi 3"]
`.trim(),
};

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession({ allowedRoles: ["SUPER_ADMIN", "ADMIN", "STAFF"] });
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ message: "Gemini API key tidak dikonfigurasi." }, { status: 503 });

    const body = await req.json();
    const { type, context = "", menuName = "", entityName = "" } = body;
    const resolvedEntity = entityName || menuName;

    const validTypes = ["notification", "menu_description", "reward_description"];
    if (!type || !validTypes.includes(type)) {
      return NextResponse.json({ message: `type harus salah satu: ${validTypes.join(", ")}.` }, { status: 400 });
    }
    if (!context && type === "notification") {
      return NextResponse.json({ message: "context wajib diisi untuk tipe notifikasi." }, { status: 400 });
    }
    if (!resolvedEntity && (type === "menu_description" || type === "reward_description")) {
      return NextResponse.json({ message: "entityName wajib diisi." }, { status: 400 });
    }

    const prompt = type === "notification"
      ? PROMPTS.notification(context)
      : type === "menu_description"
      ? PROMPTS.menu_description(resolvedEntity, context)
      : PROMPTS.reward_description(resolvedEntity, context);

    const geminiRes = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.85, maxOutputTokens: 1536 },
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("[ai/suggest] Gemini error:", geminiRes.status, errText);
      return NextResponse.json({ message: `Gemini error ${geminiRes.status}: ${errText}` }, { status: 502 });
    }

    const geminiData = await geminiRes.json();
    const raw = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    // Extract first JSON array or object from output (handles markdown fences + surrounding text)
    const jsonMatch = raw.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
    if (!jsonMatch) {
      console.error("[ai/suggest] No JSON found in Gemini output:", raw);
      return NextResponse.json({ message: "Gagal memproses respons AI. Coba lagi." }, { status: 500 });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonMatch[1]);
    } catch {
      console.error("[ai/suggest] Failed to parse Gemini output:", raw);
      return NextResponse.json({ message: "Gagal memproses respons AI. Coba lagi." }, { status: 500 });
    }

    return NextResponse.json({ success: true, suggestions: parsed });
  } catch (err: any) {
    if (isAdminAuthError(err)) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    console.error("[ai/suggest]", err);
    return NextResponse.json({ message: err.message ?? "Internal server error" }, { status: 500 });
  }
}
