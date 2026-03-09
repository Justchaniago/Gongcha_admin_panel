import DashboardClient from './DashboardClient';

export const metadata = { 
  title: 'Dashboard | Gong Cha Admin',
  description: 'Ringkasan data operasional Gong Cha'
};

export default function DashboardPage() {
  return <DashboardClient initialRole={''} initialTransactions={[]} initialUsers={[]} initialStores={[]} />;
}