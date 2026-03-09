"use client";

import { Inbox } from "lucide-react";
import React from "react";

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
}

export function EmptyState({ 
  title = "Tidak ada data ditemukan", 
  description, 
  icon = <Inbox className="w-12 h-12 text-gray-300 mb-4" /> 
}: EmptyStateProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 flex flex-col items-center justify-center text-center w-full">
      {icon}
      <p className="text-gray-500 font-medium text-base">{title}</p>
      {description && (
        <p className="text-sm text-gray-400 mt-1">{description}</p>
      )}
    </div>
  );
}