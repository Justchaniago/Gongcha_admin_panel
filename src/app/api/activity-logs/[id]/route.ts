import { NextRequest, NextResponse } from "next/server";
import { getAuditSession } from "@/lib/auditAccess";
import { isAdminAuthError } from "@/lib/adminSession";
import { getActivityLogByCompositeId, sanitizeActivityLogValue, softDeleteActivityLog, writeActivityLog } from "@/lib/activityLog";

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

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<unknown> },
) {
  try {
    const { session } = await getAuditSession("manage");
    const params = await context.params as { id?: string };
    const targetId = String(params.id ?? "").trim();
    const body = await req.json().catch(() => ({}));
    const reason = String(body.reason ?? "").trim();

    if (!targetId) {
      return NextResponse.json({ message: "Activity log id is required." }, { status: 400 });
    }

    if (!reason) {
      return NextResponse.json({ message: "Delete reason is required." }, { status: 400 });
    }

    const existing = await getActivityLogByCompositeId(targetId);
    if (!existing) {
      return NextResponse.json({ message: "Activity log not found." }, { status: 404 });
    }
    const original = existing.data;
    await softDeleteActivityLog(targetId, session, reason);

    await writeActivityLog({
      actor: session,
      action: "ACTIVITY_LOG_DELETED",
      targetType: "activity_log",
      targetId,
      targetLabel: String(original.summary ?? original.targetLabel ?? targetId),
      summary: `Deleted activity log ${targetId}`,
      source: "api/activity-logs/[id]:DELETE",
      metadata: {
        reason,
        deletedLog: sanitizeActivityLogValue({
          actorUid: original.actorUid,
          actorName: original.actorName,
          action: original.action,
          targetType: original.targetType,
          targetId: original.targetId,
          summary: original.summary,
        }),
      },
      isManual: true,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ message: getErrorMessage(error) }, { status: getErrorStatus(error) });
  }
}
