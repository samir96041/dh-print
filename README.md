# DH Print — web-to-print platform (Digital Heroes PRD, Level 2)

Six print divisions on one platform: configure → instant price → design in-browser → pay → versioned proof → approval gate → server-generated print files → production pipeline.

**Stack:** Next.js 16 (App Router) · React · Tailwind 4 · Supabase (Postgres, Auth, Storage, RLS) · Stripe Checkout · Resend · Fabric.js (designer) · resvg + pdf-lib + JSZip + PapaParse (server print engine).

## Run locally
```bash
npm install
cp .env.example .env.local      # fill in values below (never commit)
npm run dev                     # http://localhost:3000
npm test                        # pricing, fitting, print-file + CSV-merge, upload-validation checks
```
Without Supabase keys the storefront, configurator, designer and gallery already work (catalogue falls back to `src/lib/catalog.ts`); login/orders/admin need the DB.

## Set up (new accounts, per the brief)
1. **Supabase** (new project): SQL editor → run `supabase/schema.sql`, then `supabase/seed.sql`. Auth → disable "Confirm email" for the demo. Copy URL / anon key / service-role key into `.env.local`.
2. **Admin user:** sign up in the app, then in SQL: `update profiles set role='admin' where email='you@example.com';`
3. **Stripe** (optional, test mode): set `STRIPE_SECRET_KEY`; add a webhook → `/api/stripe-webhook` for `checkout.session.completed` → `STRIPE_WEBHOOK_SECRET`. *Unset = demo mode: orders are marked paid immediately.*
4. **Resend** (optional): `RESEND_API_KEY`. Unset = emails are logged to the server console.
5. **Vercel** (new account): import repo, add the env vars, set `NEXT_PUBLIC_SITE_URL` to the live URL, deploy.

## Architecture
- `src/lib/pricing.ts` — pure pricing engine (area × material × volume tier + setup, VAT 20%). Used by the live calculator **and** re-run on the server at checkout (client totals are never trusted).
- `src/lib/design.ts` — the design document (all mm). One JSON drives the designer, the proof preview, and the print file, so *what is approved is what is printed*. Includes shrink-to-fit / tracking / min–max font rules and CSV row substitution.
- `src/lib/render.ts` — server print engine: PNG/PDF at product DPI with bleed, one-PDF-per-row CSV merge (zipped), naming `OrderID_ProductType_Date_Output`. Fonts are bundled (`public/fonts`) so output is identical on any host.
- `src/lib/orders.ts` — order lifecycle, proof versions, **approval gate** (`generatePrintFiles` throws unless an approved proof exists).
- `src/lib/catalog.ts` — canonical catalogue; `npm run seed:gen` regenerates `supabase/seed.sql` from it. One parameter-driven product per division (sizes, materials, tiers are JSON — no SKU-per-size). New division = new rows, no code.

### Data model (`supabase/schema.sql`)
`profiles(role)` · `divisions` · `products(config, pricing JSON)` · `templates(layout JSON)` · `designs` · `orders` (+ `org_id` for future corporate accounts) · `order_items` · `order_status_history` · `proofs(version)` · `proof_approvals(who, which version, when)` · `print_files` · `invoices` · `gallery`. Private buckets: `artwork`, `proofs`, `print-files`.

### Roles & security
- RLS on every table: customers read only their own rows; `print_files` is admin-only; customers never receive production files or other users' data.
- Server routes use the service-role key only after verifying the caller (`currentUser` / `requireAdmin`). `/dashboard /admin /checkout /orders` are session-gated in `src/proxy.ts`; `/admin` additionally role-checked.
- Profile updates can't change `role`; admins can't demote themselves.

## Decisions where the PRD was silent
| Topic | Decision |
|---|---|
| "Quote" stage | The instant calculator replaces quote forms; a quote = a saved configuration before payment. Pipeline stages are still recorded. |
| VAT | Flat 20%, prices shown VAT-inclusive, totals re-checked server-side. |
| Currency | GBP. |
| Uploads | Finished artwork: PNG/JPG/SVG are placed on the canvas; PDF/AI are validated (extension + magic bytes, ≤15 MB), stored privately, shown on the proof as a file card, and passed to production **byte-identical** (`*_supplied.pdf`). |
| Proof revisions | "Request changes" → customer edits the design → new proof v(n+1); older versions kept as `superseded`. |
| Approval gate | Print files are generated only on approval; admin cannot advance to production/completed without an approved proof. |
| Reorder | Clones the saved design + config → checkout; no redesign. |
| Xero | Admin "Xero export" CSV in Xero's sales-invoice import shape; full API sync is the upgrade path. |

## Known limits (honest list)
- PDF output is raster at DPI (not vector); CSV merge capped at 500 rows per upload (function time limit) — move to a queue for bigger events.
- Text-fit uses a deterministic average-glyph-width model, so client and server agree; very unusual strings may fit slightly loose.
- PDF/AI files are not rasterised for the proof (a file card is shown instead); templates are edited as JSON in `/admin/products` (no visual template editor).
- Fonts: 3 bundled families (DejaVu Sans/Serif/Mono, regular + bold).
