-- Digital Heroes web-to-print schema. Run in Supabase SQL editor (then seed.sql).
create extension if not exists "pgcrypto";

create type user_role as enum ('customer','admin');
create type order_stage as enum ('quote','order','artwork','proof','production','completed');
create type proof_status as enum ('pending','changes_requested','approved','superseded');

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  email text, full_name text, company text,
  role user_role not null default 'customer',
  org_id uuid,                       -- future corporate / multi-account ordering
  created_at timestamptz default now()
);

create table divisions (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null, name text not null, blurb text, sort int default 0, active boolean default true
);

-- One parameter-driven product per division (no SKU-per-size).
-- config: { sizes:[{id,label,w_mm,h_mm}], custom_size:{min_w,max_w,min_h,max_h}|null,
--           materials:[{id,label,mult}], orientations:[..], min_qty, step }
-- pricing: { base_cents, per_cm2_cents, setup_cents, tiers:[{min,discount}] }  (tiers = volume discounts)
create table products (
  id uuid primary key default gen_random_uuid(),
  division_id uuid references divisions on delete cascade,
  slug text unique not null, name text not null, description text,
  config jsonb not null, pricing jsonb not null,
  bleed_mm numeric default 3, dpi int default 300,
  supports_csv boolean default false, active boolean default true
);

-- Template: print areas + placeholders w/ fitting rules, in mm.
-- layout: { w_mm,h_mm, safe_mm, objects:[{type,name,text,x,y,w,h,font,minFont,maxFont,tracking,variable}] }
create table templates (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products on delete cascade,
  name text not null, layout jsonb not null, active boolean default true
);

create table designs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles on delete cascade,
  product_id uuid references products, template_id uuid references templates,
  name text, data jsonb not null,            -- design JSON (objects in mm) = single source of truth for proof + print file
  config jsonb,                              -- chosen size/material/qty
  upload_path text,                          -- if finished artwork was uploaded
  thumb text, approved boolean default false,
  created_at timestamptz default now()
);

create sequence order_no_seq start 1001;
create table orders (
  id uuid primary key default gen_random_uuid(),
  order_no int unique default nextval('order_no_seq'),
  user_id uuid references profiles on delete restrict,
  org_id uuid,
  stage order_stage not null default 'order',
  archived boolean default false,
  subtotal_cents int not null, vat_cents int not null, total_cents int not null,
  currency text default 'GBP', paid boolean default false,
  stripe_session text, notes text,
  created_at timestamptz default now()
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders on delete cascade,
  product_id uuid references products, design_id uuid references designs,
  config jsonb not null, qty int not null,
  unit_cents int not null, line_cents int not null,
  csv_path text, csv_rows int
);

create table order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders on delete cascade,
  stage order_stage not null, by_user uuid references profiles, at timestamptz default now(), note text
);

-- Versioned proofs: v1, v2 ... per order item
create table proofs (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid references order_items on delete cascade,
  version int not null, design_data jsonb not null, preview_path text,
  status proof_status default 'pending', change_note text,
  created_at timestamptz default now(), unique (order_item_id, version)
);
create table proof_approvals (
  id uuid primary key default gen_random_uuid(),
  proof_id uuid references proofs on delete cascade,
  user_id uuid references profiles, action text not null,  -- approved | changes_requested
  note text, at timestamptz default now()
);

-- path = OrderID_ProductType_Date_Output/...
create table print_files (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid references order_items on delete cascade,
  kind text, path text not null, created_at timestamptz default now()
);

create table invoices (
  id uuid primary key default gen_random_uuid(),
  order_id uuid unique references orders on delete cascade,
  number text unique, issued_at timestamptz default now()
);

create table gallery (
  id uuid primary key default gen_random_uuid(),
  division_id uuid references divisions, title text, image_url text
);

-- RLS: customers see only their rows; admin sees all. Server routes use the service role.
create or replace function is_admin() returns boolean language sql stable security definer set search_path = public as
$$ select exists(select 1 from profiles where id = auth.uid() and role='admin') $$;

alter table profiles enable row level security;
alter table designs enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table order_status_history enable row level security;
alter table proofs enable row level security;
alter table proof_approvals enable row level security;
alter table print_files enable row level security;
alter table invoices enable row level security;
alter table divisions enable row level security;
alter table products enable row level security;
alter table templates enable row level security;
alter table gallery enable row level security;

create policy pub_div on divisions for select using (true);
create policy pub_prod on products for select using (true);
create policy pub_tpl on templates for select using (true);
create policy pub_gal on gallery for select using (true);
create policy adm_div on divisions for all using (is_admin());
create policy adm_prod on products for all using (is_admin());
create policy adm_tpl on templates for all using (is_admin());

create policy prof_self on profiles for select using (id = auth.uid() or is_admin());
create policy prof_upd on profiles for update using (id = auth.uid() or is_admin());
create policy des_own on designs for all using (user_id = auth.uid() or is_admin());
create policy ord_own on orders for select using (user_id = auth.uid() or is_admin());
create policy ord_adm on orders for update using (is_admin());
create policy oi_own on order_items for select using (exists(select 1 from orders o where o.id=order_id and (o.user_id=auth.uid() or is_admin())));
create policy hist_own on order_status_history for select using (exists(select 1 from orders o where o.id=order_id and (o.user_id=auth.uid() or is_admin())));
create policy proof_own on proofs for select using (exists(select 1 from order_items i join orders o on o.id=i.order_id where i.id=order_item_id and (o.user_id=auth.uid() or is_admin())));
create policy appr_own on proof_approvals for select using (user_id = auth.uid() or is_admin());
create policy inv_own on invoices for select using (exists(select 1 from orders o where o.id=order_id and (o.user_id=auth.uid() or is_admin())));
-- print_files: admin only (customers never see production files)
create policy pf_adm on print_files for select using (is_admin());

-- auto-create profile on signup
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id,email,full_name) values (new.id,new.email,new.raw_user_meta_data->>'full_name');
  return new;
end $$;
create trigger on_auth_user after insert on auth.users for each row execute function public.handle_new_user();

-- Storage buckets (private): artwork, proofs, print-files
insert into storage.buckets(id,name,public) values ('artwork','artwork',false),('proofs','proofs',false),('print-files','print-files',false) on conflict do nothing;
