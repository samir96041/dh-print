import Link from "next/link";
import { notFound } from "next/navigation";
import { currentUser } from "@/lib/supabase/server";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const u = await currentUser();
  if (!u || u.role !== "admin") notFound(); // role gate (proxy handles login redirect)
  return (
    <div className="mx-auto max-w-6xl px-4 pt-8">
      <nav className="flex gap-4 mb-6 text-sm font-semibold border-b-2 border-ink pb-2">
        <Link href="/admin" className="hover:text-accent">Pipeline</Link>
        <Link href="/admin/reports" className="hover:text-accent">Reports</Link>
        <Link href="/admin/products" className="hover:text-accent">Products</Link>
        <Link href="/admin/users" className="hover:text-accent">Users</Link>
        <a href="/api/admin/export" className="ml-auto hover:text-accent">Xero export ↓</a>
      </nav>
      {children}
    </div>
  );
}
