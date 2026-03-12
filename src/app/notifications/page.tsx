import NotificationsClient from "./NotificationsClient";

export const metadata = {
  title: "Notifications | Gongcha App Admin",
  description: "View and manage system notifications.",
};

export default function NotificationsPage() {
  return <NotificationsClient initialRole="" initialLogs={[]} members={[]} />;
}
