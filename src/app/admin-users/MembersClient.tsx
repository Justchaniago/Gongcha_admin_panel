"use client";

import { useState, useEffect } from "react";
import { useIsMobile } from "@/hooks/useIsMobile";
import MembersDesktop from "./MembersDesktop";
import MembersMobile from "./MembersMobile";

export default function MembersClient(props: any) {
  const [mounted, setMounted] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return null;

  if (isMobile) return <MembersMobile {...props} />;
  return <MembersDesktop {...props} />;
} 