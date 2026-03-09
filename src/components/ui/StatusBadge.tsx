"use client";

interface StatusBadgeProps {
  children: React.ReactNode;
  variant?: "success" | "danger" | "warning" | "neutral";
}

export function StatusBadge({ children, variant = "neutral" }: StatusBadgeProps) {
  const baseClasses = "inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border";
  
  const variants = {
    success: "bg-green-100/80 text-green-700 border-green-200/50",
    danger: "bg-red-100/80 text-red-700 border-red-200/50",
    warning: "bg-yellow-100/80 text-yellow-700 border-yellow-200/50",
    neutral: "bg-gray-100/80 text-gray-700 border-gray-200/50",
  };

  return (
    <span className={`${baseClasses} ${variants[variant]}`}>
      {children}
    </span>
  );
}