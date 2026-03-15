"use client";

import React, { useState, useEffect } from "react";
import { useIsMobile } from "@/hooks/useIsMobile";
import TransactionsDesktop from "./TransactionsDesktop";
import TransactionsMobile from "./TransactionsMobile";

interface TransactionsClientProps {
  initialTransactions?: any[];
  initialRole: string;
}

export default function TransactionsClient(props: TransactionsClientProps) {
  const [mounted, setMounted] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  // JIKA BUKA DI HP -> Render khusus Mobile
  if (isMobile) {
    return <TransactionsMobile {...props} />;
  }

  // JIKA BUKA DI LAPTOP -> Render kode aslimu (Aman 100%)
  return <TransactionsDesktop {...props} />;
}