"use client";

import React, { useState, useEffect } from "react";
import { useIsMobile } from "@/hooks/useIsMobile";
import NotificationsDesktop from "./NotificationsDesktop";
import NotificationsMobile from "./NotificationsMobile";

export default function NotificationsClient() {
  const [mounted, setMounted] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return null;
  return isMobile ? <NotificationsMobile /> : <NotificationsDesktop />;
}