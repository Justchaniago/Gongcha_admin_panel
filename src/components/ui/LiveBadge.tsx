"use client";

import { Loader2 } from "lucide-react";

type SyncStatus = "connecting" | "live" | "error";

interface LiveBadgeProps {
  status: SyncStatus;
  count?: number;
}

export function LiveBadge({ status, count }: LiveBadgeProps) {
  if (status === "connecting") {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-orange-50 border border-orange-200 text-orange-700 rounded-full text-xs font-medium shadow-sm">
        <Loader2 className="w-3 h-3 animate-spin" />
        Connecting...
      </div>
    );
  }
  
  if (status === "error") {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 text-red-700 rounded-full text-xs font-medium shadow-sm">
        <div className="w-2 h-2 bg-red-500 rounded-full" />
        Offline
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-50/80 border border-green-200 text-green-700 rounded-full text-xs font-medium shadow-sm">
      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
      Live {count !== undefined ? `· ${count} docs` : ''}
    </div>
  );
}