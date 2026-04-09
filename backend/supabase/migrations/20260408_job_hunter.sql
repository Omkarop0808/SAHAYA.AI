create table if not exists public.job_hunter_applications (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  role text not null,
  location text,
  experience text,
  skills text[] default '{}',
  status text not null default 'queued',
  source text not null default 'Auto_Jobs_Applier_AI_Agent',
  logs jsonb default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_job_hunter_applications_user_id
  on public.job_hunter_applications(user_id);

create table if not exists public.job_hunter_outreach (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  target text not null,
  channel text not null default 'email',
  tone text not null default 'formal',
  message text,
  status text not null default 'sent',
  source text not null default 'PICT-HACKATHON',
  response jsonb,
  logs jsonb default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_job_hunter_outreach_user_id
  on public.job_hunter_outreach(user_id);
