"use client";

import React, { useState, useEffect } from "react";
import { useIsMobile } from "@/hooks/useIsMobile";
import SettingsDesktop from "./SettingsDesktop";
import SettingsMobile from "./SettingsMobile";

export default function SettingsClient(props: any) {
  const [mounted, setMounted] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  if (isMobile) {
    return <SettingsMobile {...props} />;
  }

  return <SettingsDesktop {...props} />;
}