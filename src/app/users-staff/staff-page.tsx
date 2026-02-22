// staff-page.tsx — delegates to UsersStaffClient which fetches its own data
import UsersStaffClient from "./UsersStaffClient";

export default function StaffPage() {
  return <UsersStaffClient />;
}
