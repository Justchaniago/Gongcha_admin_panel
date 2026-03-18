import { FieldPath, FieldValue, Timestamp, adminDb } from "@/lib/firebaseAdmin";
import type {
  ActivityLog,
  ActivityLogAction,
  ActivityLogStatus,
  ActivityLogTargetType,
} from "@/types/firestore";
import type { AdminSession } from "@/lib/adminSession";

const ACTIVITY_LOG_DAY_COLLECTION = "activity_log_days";
const ACTIVITY_LOG_EVENT_SUBCOLLECTION = "events";
const DEFAULT_PAGE_SIZE = 20;
const READ_SCAN_DAY_BATCH = 14;

export type ActivityLogPayload = {
  actor?: AdminSession | null;
  action: ActivityLogAction;
  targetType: ActivityLogTargetType;
  targetId: string;
  targetLabel?: string | null;
  summary: string;
  status?: ActivityLogStatus;
  source: string;
  metadata?: Record<string, unknown> | null;
  isManual?: boolean;
};

export type ActivityLogResponse = {
  id: string;
  dayId: string;
  eventId: string;
  actorUid: string;
  actorName: string;
  actorEmail?: string | null;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  targetLabel?: string | null;
  summary: string;
  status: string;
  source: string;
  metadata?: Record<string, unknown>;
  createdAt: string | null;
  isManual?: boolean;
  isDeleted?: boolean;
  deletedAt?: string | null;
  deletedBy?: string;
  deleteReason?: string;
};

type ActivityLogCursor = {
  dayId: string;
  createdAt: string;
  eventId: string;
};

export type ListActivityLogsOptions = {
  pageSize?: number;
  cursor?: string | null;
  action?: string;
  actor?: string;
  search?: string;
  includeDeleted?: boolean;
};

function formatJakartaDateId(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

// Partition logs by Asia/Jakarta event date so writes stay distributed and
// reads can scan recent buckets incrementally instead of a single hot collection.
function getDayRef(dayId: string) {
  return adminDb.collection(ACTIVITY_LOG_DAY_COLLECTION).doc(dayId);
}

function getEventRef(dayId: string, eventId: string) {
  return getDayRef(dayId).collection(ACTIVITY_LOG_EVENT_SUBCOLLECTION).doc(eventId);
}

function isTimestampLike(value: unknown): value is { toDate: () => Date } {
  return Boolean(value) && typeof value === "object" && typeof (value as { toDate?: unknown }).toDate === "function";
}

function isGeoPointLike(value: unknown): value is { latitude: number; longitude: number } {
  return Boolean(value)
    && typeof value === "object"
    && typeof (value as { latitude?: unknown }).latitude === "number"
    && typeof (value as { longitude?: unknown }).longitude === "number";
}

export function sanitizeActivityLogValue(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();
  if (isTimestampLike(value)) return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map((item) => sanitizeActivityLogValue(item));
  if (isGeoPointLike(value)) return { latitude: value.latitude, longitude: value.longitude };

  if (typeof value === "object") {
    const plain: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (typeof nested === "function" || nested === undefined) continue;
      plain[key] = sanitizeActivityLogValue(nested);
    }
    return plain;
  }

  return String(value);
}

export function encodeActivityLogCursor(cursor: ActivityLogCursor | null) {
  if (!cursor) return null;
  return Buffer.from(JSON.stringify(cursor), "utf-8").toString("base64url");
}

// Cursor shape is day-aware because pagination can span multiple date buckets.
export function decodeActivityLogCursor(cursor: string | null | undefined): ActivityLogCursor | null {
  if (!cursor) return null;
  try {
    const raw = Buffer.from(cursor, "base64url").toString("utf-8");
    const parsed = JSON.parse(raw) as Partial<ActivityLogCursor>;
    if (!parsed.dayId || !parsed.createdAt || !parsed.eventId) return null;
    return {
      dayId: parsed.dayId,
      createdAt: parsed.createdAt,
      eventId: parsed.eventId,
    };
  } catch {
    return null;
  }
}

function matchesFilters(log: ActivityLogResponse, options: Required<Pick<ListActivityLogsOptions, "action" | "actor" | "search" | "includeDeleted">>) {
  if (!options.includeDeleted && log.isDeleted === true) return false;
  if (options.action && log.action !== options.action) return false;

  const actor = options.actor.trim().toLowerCase();
  if (actor) {
    const actorHit =
      String(log.actorName ?? "").toLowerCase().includes(actor)
      || String(log.actorEmail ?? "").toLowerCase().includes(actor)
      || String(log.actorUid ?? "").toLowerCase().includes(actor);
    if (!actorHit) return false;
  }

  const search = options.search.trim().toLowerCase();
  if (search) {
    const haystacks = [
      log.summary,
      log.targetLabel ?? "",
      log.targetId,
      JSON.stringify(log.metadata ?? {}),
    ].map((value) => String(value ?? "").toLowerCase());
    if (!haystacks.some((value) => value.includes(search))) return false;
  }

  return true;
}

function serializeActivityLogDoc(dayId: string, eventId: string, data: FirebaseFirestore.DocumentData): ActivityLogResponse {
  return {
    id: `${dayId}__${eventId}`,
    dayId,
    eventId,
    actorUid: String(data.actorUid ?? ""),
    actorName: String(data.actorName ?? ""),
    actorEmail: data.actorEmail ?? null,
    actorRole: String(data.actorRole ?? ""),
    action: String(data.action ?? ""),
    targetType: String(data.targetType ?? ""),
    targetId: String(data.targetId ?? ""),
    targetLabel: data.targetLabel ?? null,
    summary: String(data.summary ?? ""),
    status: String(data.status ?? "success"),
    source: String(data.source ?? ""),
    metadata: (sanitizeActivityLogValue(data.metadata ?? {}) as Record<string, unknown>) ?? {},
    createdAt: isTimestampLike(data.createdAt) ? data.createdAt.toDate().toISOString() : data.createdAt ?? null,
    isManual: data.isManual === true,
    isDeleted: data.isDeleted === true,
    deletedAt: isTimestampLike(data.deletedAt) ? data.deletedAt.toDate().toISOString() : data.deletedAt ?? null,
    deletedBy: data.deletedBy ?? undefined,
    deleteReason: data.deleteReason ?? undefined,
  };
}

async function fetchDayDocs(startAfterDayId?: string | null) {
  let query = adminDb
    .collection(ACTIVITY_LOG_DAY_COLLECTION)
    .orderBy("date", "desc")
    .limit(READ_SCAN_DAY_BATCH);

  if (startAfterDayId) {
    query = query.startAfter(startAfterDayId) as typeof query;
  }

  return query.get();
}

async function fetchEventsForDay(dayId: string, remaining: number, cursor?: ActivityLogCursor | null) {
  let query = getDayRef(dayId)
    .collection(ACTIVITY_LOG_EVENT_SUBCOLLECTION)
    .orderBy("createdAt", "desc")
    .orderBy(FieldPath.documentId(), "desc")
    .limit(Math.max(remaining * 2, remaining, DEFAULT_PAGE_SIZE));

  if (cursor && cursor.dayId === dayId) {
    query = query.startAfter(Timestamp.fromDate(new Date(cursor.createdAt)), cursor.eventId) as typeof query;
  }

  return query.get();
}

export async function writeActivityLog(payload: ActivityLogPayload) {
  if (!payload.actor) return null;

  const now = new Date();
  const dayId = formatJakartaDateId(now);
  const dayRef = getDayRef(dayId);
  const eventRef = dayRef.collection(ACTIVITY_LOG_EVENT_SUBCOLLECTION).doc();

  const doc: Omit<ActivityLog, "id" | "createdAt"> & { createdAt: FirebaseFirestore.FieldValue } = {
    actorUid: payload.actor.uid,
    actorName: String(payload.actor.profile?.name ?? payload.actor.email?.split("@")[0] ?? payload.actor.uid),
    actorEmail: payload.actor.email ?? null,
    actorRole: payload.actor.role,
    action: payload.action,
    targetType: payload.targetType,
    targetId: payload.targetId,
    targetLabel: payload.targetLabel ?? null,
    summary: payload.summary,
    status: payload.status ?? "success",
    source: payload.source,
    metadata: (sanitizeActivityLogValue(payload.metadata ?? {}) as Record<string, unknown>) ?? {},
    createdAt: FieldValue.serverTimestamp(),
    isManual: payload.isManual === true,
    isDeleted: false,
  };

  await Promise.all([
    dayRef.set(
      {
        date: dayId,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    ),
    eventRef.set(doc),
  ]);

  return `${dayId}__${eventRef.id}`;
}

export async function listActivityLogs(options: ListActivityLogsOptions = {}) {
  const pageSize = Math.min(Math.max(options.pageSize ?? DEFAULT_PAGE_SIZE, 1), DEFAULT_PAGE_SIZE);
  const cursor = decodeActivityLogCursor(options.cursor);
  const filters = {
    action: String(options.action ?? ""),
    actor: String(options.actor ?? ""),
    search: String(options.search ?? ""),
    includeDeleted: options.includeDeleted === true,
  };

  const logs: ActivityLogResponse[] = [];
  let nextCursor: string | null = null;
  let activeDayId: string | null = cursor?.dayId ?? null;
  let daySnap: FirebaseFirestore.QuerySnapshot<FirebaseFirestore.DocumentData>;

  if (activeDayId) {
    daySnap = await fetchDayDocs();
  } else {
    daySnap = await fetchDayDocs();
  }

  let dayIds = daySnap.docs.map((doc) => doc.id);
  if (activeDayId && !dayIds.includes(activeDayId)) {
    dayIds = [activeDayId, ...dayIds.filter((id) => id !== activeDayId)];
  }

  let dayIndex = 0;
  let carryCursor = cursor;

  while (logs.length < pageSize) {
    if (dayIndex >= dayIds.length) {
      const lastDayId = dayIds[dayIds.length - 1];
      if (!lastDayId) break;
      const moreDays = await fetchDayDocs(lastDayId);
      if (moreDays.empty) break;
      dayIds = [...dayIds, ...moreDays.docs.map((doc) => doc.id)];
      continue;
    }

    const dayId = dayIds[dayIndex];
    const remaining = pageSize - logs.length;
    const eventsSnap = await fetchEventsForDay(dayId, remaining, carryCursor);

    if (eventsSnap.empty) {
      carryCursor = null;
      dayIndex += 1;
      continue;
    }

    for (const eventDoc of eventsSnap.docs) {
      const serialized = serializeActivityLogDoc(dayId, eventDoc.id, eventDoc.data());
      if (!matchesFilters(serialized, filters)) continue;
      logs.push(serialized);
      nextCursor = encodeActivityLogCursor({
        dayId,
        createdAt: serialized.createdAt ?? new Date(0).toISOString(),
        eventId: eventDoc.id,
      });
      if (logs.length >= pageSize) break;
    }

    const lastEvent = eventsSnap.docs[eventsSnap.docs.length - 1];
    carryCursor = lastEvent
      ? {
          dayId,
          createdAt: isTimestampLike(lastEvent.data().createdAt)
            ? lastEvent.data().createdAt.toDate().toISOString()
            : new Date(0).toISOString(),
          eventId: lastEvent.id,
        }
      : null;

    if (logs.length < pageSize) {
      carryCursor = null;
      dayIndex += 1;
    }
  }

  return {
    logs,
    nextCursor: logs.length < pageSize ? null : nextCursor,
  };
}

export function parseCompositeActivityLogId(compositeId: string) {
  const [dayId, ...rest] = compositeId.split("__");
  const eventId = rest.join("__");
  if (!dayId || !eventId) {
    throw new Error("Invalid activity log id.");
  }
  return { dayId, eventId };
}

export async function getActivityLogByCompositeId(compositeId: string) {
  const { dayId, eventId } = parseCompositeActivityLogId(compositeId);
  const snap = await getEventRef(dayId, eventId).get();
  if (!snap.exists) return null;
  return { dayId, eventId, data: snap.data() ?? {} };
}

export async function softDeleteActivityLog(compositeId: string, deletedBy: AdminSession, reason: string) {
  const { dayId, eventId } = parseCompositeActivityLogId(compositeId);
  await getEventRef(dayId, eventId).update({
    isDeleted: true,
    deletedAt: Timestamp.now(),
    deletedBy: deletedBy.uid,
    deleteReason: reason,
  });
}
