// Finished-artwork upload rules (PDF, AI, SVG, PNG). Shared by the API and tests.
export const MAX_UPLOAD = 15_000_000;
export const ART_EXT = ["pdf", "ai", "svg", "png", "jpg", "jpeg"] as const;

/** Validate by extension AND magic bytes, so a renamed .exe can't be stored as artwork. */
export function checkArtwork(name: string, head: Uint8Array, size: number): { ok: true; ext: string } | { ok: false; error: string } {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (!(ART_EXT as readonly string[]).includes(ext)) return { ok: false, error: "Accepted formats: PDF, AI, SVG, PNG, JPG" };
  if (size > MAX_UPLOAD) return { ok: false, error: "File must be under 15 MB" };
  const s = Buffer.from(head.slice(0, 16)).toString("latin1");
  const ok =
    ext === "pdf" || ext === "ai" ? s.startsWith("%PDF") || s.startsWith("%!PS")   // AI is PDF- or PostScript-based
    : ext === "png" ? head[0] === 0x89 && s.slice(1, 4) === "PNG"
    : ext === "jpg" || ext === "jpeg" ? head[0] === 0xff && head[1] === 0xd8
    : /<svg|<\?xml/i.test(Buffer.from(head).toString("utf8"));
  return ok ? { ok: true, ext } : { ok: false, error: `That doesn't look like a valid .${ext} file` };
}
