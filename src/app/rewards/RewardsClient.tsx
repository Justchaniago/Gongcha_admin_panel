"use client";

import React, { useState, useEffect } from "react";
import { useIsMobile } from "@/hooks/useIsMobile";
import RewardsDesktop from "./RewardsDesktop";
import RewardsMobile from "./RewardsMobile";

export default function RewardsClient(props: any) {
  const [mounted, setMounted] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  if (isMobile) {
    return <RewardsMobile {...props} />;
  }

  return <RewardsDesktop {...props} />;
}