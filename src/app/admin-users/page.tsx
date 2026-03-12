import MembersClient from './MembersClient';

export const metadata = {
  title: 'User & Staff | Gongcha App Admin',
  description: 'Manage customer and staff accounts.'
};

export default function AdminUsersPage() {
  return <MembersClient />;
}