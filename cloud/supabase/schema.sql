-- KitaPH Cloud schema. Run in the Supabase SQL editor.
-- Backups are end-to-end encrypted on the phone; these columns hold ciphertext only.

create table if not exists public.backups (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  ciphertext  text        not null,
  nonce       text        not null,
  salt        text        not null,
  kdf         text        not null,
  iterations  integer     not null,
  cipher      text        not null,
  version     integer     not null default 1,
  updated_at  timestamptz not null default now()
);

alter table public.backups enable row level security;

drop policy if exists "Users manage only their own backup" on public.backups;
create policy "Users manage only their own backup" on public.backups
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Public reference data (exchange rates, PSA/DOLE figures). Readable by anyone, written by admins only.
create table if not exists public.reference_data (
  id          bigint generated always as identity primary key,
  as_of       date        not null,
  payload     jsonb       not null,
  created_at  timestamptz not null default now()
);

alter table public.reference_data enable row level security;

drop policy if exists "Reference data is public" on public.reference_data;
create policy "Reference data is public" on public.reference_data for select using (true);
