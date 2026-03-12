import TransactionsClient from "./TransactionsClient";

export const metadata = {
  title: "Transactions | Gongcha App Admin",
  description: "View and manage transaction records.",
};

export default function TransactionsPage() {
  return <TransactionsClient initialTransactions={[]} initialRole={""} />;
}
