import DashboardClient from './DashboardClient';

export const metadata = { 
  title: 'Dashboard | Gongcha App Admin',
  description: 'View and analyze operational data for Gong Cha stores, users, and transactions.'
};

export default function DashboardPage() {
  return <DashboardClient initialRole={''} initialTransactions={[]} initialUsers={[]} initialStores={[]} />;
}