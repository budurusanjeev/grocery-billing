-- Grocery Billing — multi-tenant schema.
-- Run this once in the Supabase SQL Editor (Supabase project → SQL Editor → New query).
--
-- IMPORTANT: the server proxy (server/lib/supabaseAdmin.js) talks to this
-- database using the service-role key, which BYPASSES Row Level Security
-- entirely. The RLS policies below are still worth having (defense-in-depth,
-- and they protect any future direct-client access), but tenant isolation
-- for the proxy is enforced ONLY by the server explicitly filtering every
-- query on shopkeeper_id. Never assume RLS alone protects this data.

create extension if not exists pgcrypto;

-- One row per shopkeeper/shop, 1:1 with Supabase's own auth.users.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  shop_name text not null default 'My Shop',
  phone text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);

-- Auto-create a profile the instant someone signs up, so items.shopkeeper_id
-- always has a valid row to point at with zero manual steps.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, shop_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'shop_name', 'My Shop'));
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users for each row execute procedure public.handle_new_user();

-- Each shopkeeper's private catalog.
create table public.items (
  id text primary key default gen_random_uuid()::text,
  shopkeeper_id uuid not null references public.profiles(id) on delete cascade,
  name_en text not null,
  name_te text not null default '',
  aliases text[] not null default '{}',
  category text not null default 'Custom',
  brand text,
  unit text not null check (unit in ('kg','packet','piece','litre','dozen')),
  price numeric(10,2) not null check (price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index items_shopkeeper_id_idx on public.items(shopkeeper_id);

alter table public.items enable row level security;
create policy "items_select_own" on public.items for select using (auth.uid() = shopkeeper_id);
create policy "items_insert_own" on public.items for insert with check (auth.uid() = shopkeeper_id);
create policy "items_update_own" on public.items for update using (auth.uid() = shopkeeper_id) with check (auth.uid() = shopkeeper_id);
create policy "items_delete_own" on public.items for delete using (auth.uid() = shopkeeper_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger items_set_updated_at
  before update on public.items for each row execute procedure public.set_updated_at();

-- Cloud-persisted billing history — uploaded on demand via a dedicated
-- button (Today's Bills screen), never automatically. `id text` (not uuid)
-- so the client's own local bill id (a timestamp string, see src/lib/db.ts)
-- can be reused directly as the primary key — this makes re-uploading the
-- same bills an idempotent upsert instead of creating duplicate rows.
create table public.bills (
  id text primary key,
  shopkeeper_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  lines jsonb not null default '[]'::jsonb,
  total numeric(10,2) not null default 0,
  payment_method text
);
create index bills_shopkeeper_id_idx on public.bills(shopkeeper_id);
alter table public.bills enable row level security;
create policy "bills_select_own" on public.bills for select using (auth.uid() = shopkeeper_id);
create policy "bills_insert_own" on public.bills for insert with check (auth.uid() = shopkeeper_id);
create policy "bills_update_own" on public.bills for update using (auth.uid() = shopkeeper_id) with check (auth.uid() = shopkeeper_id);

-- Saved UPI QR codes (Payment QR Codes screen). `id text` for the same
-- reason as bills: the client's own local id is reused as the primary key,
-- so re-syncing is an idempotent upsert instead of creating duplicates.
-- image_uri holds the full data: URI (base64) -- same shape as it's stored
-- on-device in AsyncStorage, so no conversion is needed on either end.
create table public.qr_codes (
  id text primary key,
  shopkeeper_id uuid not null references public.profiles(id) on delete cascade,
  label text not null,
  image_uri text not null,
  created_at timestamptz not null default now()
);
create index qr_codes_shopkeeper_id_idx on public.qr_codes(shopkeeper_id);
alter table public.qr_codes enable row level security;
create policy "qr_codes_select_own" on public.qr_codes for select using (auth.uid() = shopkeeper_id);
create policy "qr_codes_insert_own" on public.qr_codes for insert with check (auth.uid() = shopkeeper_id);
create policy "qr_codes_delete_own" on public.qr_codes for delete using (auth.uid() = shopkeeper_id);
