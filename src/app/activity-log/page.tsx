import ActivityLogClient from "./ActivityLogClient";

export const metadata = {
  title: "Activity Log | Gongcha App Admin",
  description: "Developer audit trail for admin panel write activity.",
};

export default function ActivityLogPage() {
  return <ActivityLogClient />;
}
