import React from "react";
import { GcModalShell } from "@/components/ui/gc";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  width?: string;
}

export default function Modal({ open, onClose, children, title, width = "400px" }: ModalProps) {
  if (!open) return null;
  return (
    <GcModalShell onClose={onClose} title={title || "Dialog"} maxWidth={Number.parseInt(width, 10) || 400}>
      {children}
    </GcModalShell>
  );
}
