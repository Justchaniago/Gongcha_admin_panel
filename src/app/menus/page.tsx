import MenusClient from "./MenusClient";

export const metadata = {
  title: "Product Management | Gongcha App Admin",
  description: "Manage product menu items and categories.",
  eyebrow: "Gongcha App Admin",
};

export default function MenusPage() {
  return <MenusClient initialMenus={[]} />;
}
