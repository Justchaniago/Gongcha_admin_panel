import React from "react";

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
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-8 shadow-lg" style={{ width }}>
        {title && <h2 className="font-bold text-lg mb-4">{title}</h2>}
        {children}
        <button className="mt-4 px-4 py-2 bg-blue-600 text-white rounded" onClick={onClose}>Tutup</button>
      </div>
    </div>
  );
}
