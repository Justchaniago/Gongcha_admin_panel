import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Notifications – Gong Cha Admin",
};

export default function NotificationsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
