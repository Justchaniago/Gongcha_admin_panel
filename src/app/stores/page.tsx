import StoresClient from "./StoresClient";

export const metadata = { title: "Stores | Gong Cha Admin" };

export default function StoresPage() {
  return <StoresClient initialStores={[]} />;
}