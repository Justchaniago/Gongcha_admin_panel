"use client";

import React from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  eyebrow?: string; // Teks kecil di atas judul (misal: "GONG CHA ADMIN")
  rightContent?: React.ReactNode; // Tempat menaruh tombol atau LiveBadge
}

export function PageHeader({ 
  title, 
  description, 
  eyebrow = "GONG CHA ADMIN", 
  rightContent 
}: PageHeaderProps) {
  return (
    <div className="mb-8">
      {eyebrow && (
        <h2 className="text-xs font-bold tracking-widest text-gray-500 uppercase mb-1">
          {eyebrow}
        </h2>
      )}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">{title}</h1>
          {description && (
            <p className="text-sm text-gray-500 mt-1">{description}</p>
          )}
        </div>
        
        {rightContent && (
          <div className="flex items-center gap-3">
            {rightContent}
          </div>
        )}
      </div>
    </div>
  );
}