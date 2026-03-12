import StoresClient from "./StoresClient";

export const metadata = {
  title: "Stores | Gongcha App Admin",
  description: "Manage store information, locations, and operational details.",
};

export default function StoresPage() {
  return <StoresClient initialStores={[]} />;
}