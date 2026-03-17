"use client";

import React, { useState, useEffect } from "react";
import { useIsMobile } from "@/hooks/useIsMobile";
import StoresDesktop from "./StoresDesktop";
import StoresMobile from "./StoresMobile";
import { Store } from "@/types/firestore";

type StoreWithId = Store & { id: string };

export default function StoresClient({ initialStores = [], showAddTrigger }: { initialStores?: StoreWithId[]; showAddTrigger?: boolean }) {
  const [mounted, setMounted] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  // JIKA BUKA DI HP -> Render khusus Mobile
  if (isMobile) {
    return <StoresMobile initialStores={initialStores} showAddTrigger={showAddTrigger} />;
  }

  // JIKA BUKA DI LAPTOP -> Render Desktop asli
  return <StoresDesktop initialStores={initialStores} showAddTrigger={showAddTrigger} />;
}