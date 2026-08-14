import { NextRequest, NextResponse } from "next/server";

const FASTAPI_URL = process.env.FASTAPI_INTERNAL_URL || "http://127.0.0.1:8000/api/v1";

async function proxyRequest(req: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  const { path } = await context.params;
  const targetPath = path ? path.join("/") : "";
  const targetUrl = `${FASTAPI_URL}/${targetPath}${req.nextUrl.search}`;

  try {
    const headers = new Headers();
    const contentType = req.headers.get("content-type");
    if (contentType) {
      headers.set("content-type", contentType);
    }

    const body = ["GET", "HEAD"].includes(req.method) ? undefined : await req.text();

    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
      cache: "no-store",
    });

    const responseData = await response.text();
    return new NextResponse(responseData, {
      status: response.status,
      headers: {
        "content-type": response.headers.get("content-type") || "application/json",
      },
    });
  } catch (error: any) {
    console.error(`Proxy Error [${req.method} /${targetPath}]:`, error);
    return NextResponse.json(
      { message: `Gateway Error: ${error?.message || "Failed to reach backend service"}` },
      { status: 502 }
    );
  }
}

export { proxyRequest as GET, proxyRequest as POST, proxyRequest as PUT, proxyRequest as DELETE, proxyRequest as PATCH };
