import TransactionsClient from "./TransactionsClient";

export const metadata = { title: "Transactions | Gong Cha Admin" };

export default function TransactionsPage() {
  return <TransactionsClient initialTransactions={[]} initialRole={""} />;
}
