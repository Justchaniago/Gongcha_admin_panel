// src/app/transactions/page.tsx
// Server component shell — delegates all interactivity to TransactionsClient
import TransactionsClient from "./TransactionsClient";

export default function TransactionsPage() {
  return <TransactionsClient />;
}
