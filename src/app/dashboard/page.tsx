// app/dashboard/page.tsx
// Server component — just renders the realtime client
import DashboardClient from "./DashboardClient";

export default function DashboardPage() {
  return <DashboardClient />;
}