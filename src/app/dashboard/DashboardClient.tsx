"use client";

import React, { useState, useEffect } from "react";
import { useIsMobile } from "@/hooks/useIsMobile";
import DashboardDesktop from "./DashboardDesktop";
import DashboardMobile from "./DashboardMobile"; // Nanti kita isi ini khusus mobile

interface DashboardProps {
  initialRole: string;
  initialTransactions: any[];
  initialUsers: any[];
  initialStores: any[];
}

export default function DashboardClient(props: DashboardProps) {
  // Cegah hydration mismatch antara server dan client
  const [mounted, setMounted] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null; // Atau tampilkan loading spinner bawaanmu
  }

  // JIKA BUKA DI HP -> Render khusus Mobile
  if (isMobile) {
    return <DashboardMobile {...props} />;
  }

  // JIKA BUKA DI LAPTOP -> Render kode aslimu (Aman 100%)
  return <DashboardDesktop {...props} />;
}