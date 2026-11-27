"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { STAGES } from "@/lib/stages";

async function patch(url: string, body: object) {
  const r = await fetch(url, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return r.ok ? null : ((await r.json().catch(() => ({}))).error ?? "Failed");
}

export function StageControl({ id, stage, archived }: { id: string; stage: string; archived: boolean }) {
  const router = useRouter(); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const next = STAGES[STAGES.indexOf(stage as (typeof STAGES)[number]) + 1];
  async function go(body: object) { setBusy(true); setErr(""); const e = await patch(`/api/admin/orders/${id}`, body); setBusy(false); if (e) setErr(e); else router.refresh(); }
  return (
    <div className="flex flex-col gap-1 items-start">
      <div className="flex gap-1 flex-wrap">
        {next && <button className="btn !py-1 !px-2 text-xs" disabled={busy} onClick={() => go({ stage: next })}>→ {next}</button>}
        {stage === "completed" && <button className="btn btn-ghost !py-1 !px-2 text-xs" disabled={busy} onClick={() => go({ archived: !archived })}>{archived ? "Unarchive" : "Archive"}</button>}
      </div>
      {err && <span role="alert" className="text-xs text-red-700 max-w-48">{err}</span>}
    </div>
  );
}

export function RoleSelect({ id, role }: { id: string; role: string }) {
  const router = useRouter();
  return <select className="field !py-1 !w-auto" defaultValue={role} onChange={async (e) => { const err = await patch(`/api/admin/users/${id}`, { role: e.target.value }); if (err) alert(err); router.refresh(); }}>
    <option>customer</option><option>admin</option></select>;
}
