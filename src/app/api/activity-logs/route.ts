import { NextRequest, NextResponse } from "next/server";
import { getAuditSession } from "@/lib/auditAccess";
import { isAdminAuthError } from "@/lib/adminSession";
import { listActivityLogs, writeActivityLog } from "@/lib/activityLog";

function getErrorStatus(error: unknown) {
  if (isAdminAuthError(error)) return error.status;
  if (error instanceof Error && typeof (error as Error & { status?: unknown }).status === "number") {
    return (error as Error & { status: number }).status;
  }
  return 500;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Internal server error.";
}

export async function GET(req: NextRequest) {
  try {
    const { access } = await getAuditSession("read");
    const url = req.nextUrl;
    const action = String(url.searchParams.get("action") ?? "").trim();
    const actor = String(url.searchParams.get("actor") ?? "").trim().toLowerCase();
    const search = String(url.searchParams.get("search") ?? "").trim().toLowerCase();
    const includeDeleted = access.canManage && url.searchParams.get("includeDeleted") === "1";
    const cursor = String(url.searchParams.get("cursor") ?? "").trim();

    const { logs, nextCursor } = await listActivityLogs({
      pageSize: 20,
      cursor: cursor || null,
      action,
      actor,
      search,
      includeDeleted,
    });

    return NextResponse.json({
      success: true,
      access,
      logs,
      nextCursor,
      pageSize: 20,
    });
  } catch (error) {
    return NextResponse.json({ message: getErrorMessage(error) }, { status: getErrorStatus(error) });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { session, access } = await getAuditSession("manage");
    const body = await req.json();
    const summary = String(body.summary ?? "").trim();
    const note = String(body.note ?? "").trim();

    if (!summary) {
      return NextResponse.json({ message: "summary is required." }, { status: 400 });
    }

    const id = await writeActivityLog({
      actor: session,
      action: "ACTIVITY_LOG_NOTE_CREATED",
      targetType: "activity_log",
      targetId: "manual-note",
      targetLabel: "Manual note",
      summary,
      source: "api/activity-logs:POST",
      metadata: { note },
      isManual: true,
    });

    return NextResponse.json({ success: true, id, access });
  } catch (error) {
    return NextResponse.json({ message: getErrorMessage(error) }, { status: getErrorStatus(error) });
  }
}
