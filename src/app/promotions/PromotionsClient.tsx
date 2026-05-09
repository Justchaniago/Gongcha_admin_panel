"use client";

import React, { useState, useEffect } from "react";
import { useIsMobile } from "@/hooks/useIsMobile";
import PromotionsDesktop from "./PromotionsDesktop";
import PromotionsMobile from "./PromotionsMobile";

export default function PromotionsClient() {
  const [mounted, setMounted] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;
  if (isMobile) return <PromotionsMobile />;
  return <PromotionsDesktop />;
}
