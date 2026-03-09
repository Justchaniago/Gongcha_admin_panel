import MembersClient from './MembersClient';

export const metadata = {
  title: 'User & Staff | Gong Cha Admin',
  description: 'Manajemen akun pelanggan dan staf'
};

export default function AdminUsersPage() {
  return <MembersClient />;
}