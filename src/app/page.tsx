import { redirect } from "next/navigation";
export default function Home() {
  redirect("/login");
  return (
    <div>
      <h1>Gongcha App Admin</h1>
      <p>Redirects to login.</p>
    </div>
  );
}
