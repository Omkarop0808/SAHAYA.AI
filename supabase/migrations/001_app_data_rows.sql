-- Generic row store for SAHAYA.AI (code-a-hunt). Each legacy JSON collection becomes many rows.
-- Backend uses the service role key — do NOT expose that key in the browser.

create table if not exists public.app_data_rows (
  collection text not null,
  row_id text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (collection, row_id)
);

create index if not exists idx_app_data_rows_collection on public.app_data_rows (collection);

comment on table public.app_data_rows is 'Stores all app documents; collection name matches former backend/data/<name>.json file.';

-- Optional: tighten access (service role bypasses RLS when used from Node).
alter table public.app_data_rows enable row level security;

-- No policies = only service role / dashboard can access when using anon key without policies.
-- If you later add Supabase Auth linked to app user ids, add policies on (payload->>'userId').
