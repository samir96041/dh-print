import { Resend } from "resend";

/** Order / proof / completion notifications. Logs instead of sending when RESEND_API_KEY is unset (local/dev). */
export async function notify(to: string | null | undefined, subject: string, html: string) {
  if (!to) return;
  if (!process.env.RESEND_API_KEY) { console.log(`[email → ${to}] ${subject}`); return; }
  try {
    await new Resend(process.env.RESEND_API_KEY).emails.send({ from: process.env.EMAIL_FROM ?? "DH Print <onboarding@resend.dev>", to, subject, html });
  } catch (e) { console.error("email failed", e); } // never fail an order because mail failed
}
