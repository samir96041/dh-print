import { supabaseAdmin } from "@/lib/supabase/server";
import { RoleSelect } from "../AdminClient";

export default async function Users() {
  const { data } = await supabaseAdmin().from("profiles").select("id, email, full_name, role, created_at").order("created_at", { ascending: false });
  return (
    <div className="panel overflow-x-auto"><table className="w-full text-sm">
      <thead><tr className="text-left mono text-xs uppercase text-muted"><th className="p-3">Name</th><th>Email</th><th>Joined</th><th>Role</th></tr></thead>
      <tbody>{data?.map((u) => <tr key={u.id} className="border-t border-line"><td className="p-3">{u.full_name}</td><td>{u.email}</td>
        <td>{new Date(u.created_at).toLocaleDateString("en-GB")}</td><td><RoleSelect id={u.id} role={u.role} /></td></tr>)}</tbody>
    </table></div>
  );
}
