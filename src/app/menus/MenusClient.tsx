"use client";

import React, { useState, useEffect } from "react";
import { useIsMobile } from "@/hooks/useIsMobile";
import MenusDesktop from "./MenusDesktop";
import MenusMobile from "./MenusMobile";

export default function MenusClient(props: any) {
  const [mounted, setMounted] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  // JIKA BUKA DI HP -> Render khusus Mobile
  if (isMobile) {
    return <MenusMobile {...props} />;
  }

  // JIKA BUKA DI LAPTOP -> Render Desktop asli
  return <MenusDesktop {...props} />;
}