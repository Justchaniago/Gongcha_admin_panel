// lib/useRealtimeFirestore.ts
"use client";

import { useEffect, useState, useCallback } from "react";
import {
  collection, onSnapshot, query, orderBy, limit,
  QueryConstraint, DocumentData, QuerySnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";

export type SyncStatus = "connecting" | "live" | "error";

export function useRealtimeCollection<T>(
  collectionName: string,
  transform: (snap: QuerySnapshot<DocumentData>) => T[],
  initialData: T[],
  constraints: QueryConstraint[] = [],
) {
  const [data,   setData]   = useState<T[]>(initialData);
  const [status, setStatus] = useState<SyncStatus>("connecting");

  useEffect(() => {
    setStatus("connecting");
    const q = query(collection(db, collectionName), ...constraints);
    const unsub = onSnapshot(
      q,
      (snap) => { setData(transform(snap)); setStatus("live"); },
      (err)  => { console.error(`[${collectionName}]`, err); setStatus("error"); },
    );
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionName]);

  return { data, status };
}