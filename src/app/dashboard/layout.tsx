import { AuthProvider } from "@/components/AuthProvider";

// Sidebar sudah di-handle oleh AdminShell di root layout.
// Layout ini hanya menyediakan AuthProvider tambahan jika diperlukan.
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  );
}