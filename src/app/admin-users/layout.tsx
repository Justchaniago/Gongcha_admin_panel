import Sidebar from "@/components/layout/Sidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen" style={{ background: "#F1F5FF" }}>
      <Sidebar />
      <main className="flex-1 min-h-screen overflow-y-auto" style={{ marginLeft: "72px" }}>
        {children}
      </main>
    </div>
  );
}
