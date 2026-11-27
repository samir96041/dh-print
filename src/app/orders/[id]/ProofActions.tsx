"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ProofActions({ proofId }: { proofId: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "changes">("idle"); const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  async function send(action: "approve" | "changes") {
    setBusy(true); setErr("");
    const r = await fetch(`/api/proofs/${proofId}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, note }) });
    setBusy(false);
    if (!r.ok) return setErr((await r.json().catch(() => ({}))).error ?? "Failed");
    router.refresh();
  }
  return (
    <div className="mt-3 space-y-2">
      {mode === "idle" ? (
        <div className="flex flex-wrap gap-2">
          <button className="btn" disabled={busy} onClick={() => send("approve")}>{busy ? "Approving…" : "Approve proof ✓"}</button>
          <button className="btn btn-ghost" onClick={() => setMode("changes")}>Request changes</button>
        </div>
      ) : (
        <>
          <textarea className="field" rows={3} placeholder="What should change?" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex gap-2"><button className="btn" disabled={busy} onClick={() => send("changes")}>Send request</button>
            <button className="btn btn-ghost" onClick={() => setMode("idle")}>Cancel</button></div>
        </>
      )}
      <p className="text-xs text-muted">Approving locks this version — it is exactly what will be printed.</p>
      {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
    </div>
  );
}
