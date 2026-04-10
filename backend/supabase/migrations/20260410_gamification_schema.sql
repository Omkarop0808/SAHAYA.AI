-- Gamification Schema Migration
-- Defines exact tables structured for the Unified XP System

create table if not exists public.gamification_profiles (
  user_id text primary key,
  xp bigint not null default 0,
  level int not null default 1,
  streak int not null default 0,
  last_streak_date date,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.daily_quests (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  title text not null,
  description text,
  xp_reward int not null,
  category text not null,
  status text not null default 'pending', 
  progress int not null default 0,
  target int not null default 1,
  slug text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.user_titles (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  title_key text not null,
  is_active boolean not null default false,
  earned_at timestamptz not null default now()
);

create table if not exists public.user_emotes (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  emote_key text not null,
  earned_at timestamptz not null default now()
);

create table if not exists public.user_frames (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  frame_key text not null,
  is_active boolean not null default false,
  earned_at timestamptz not null default now()
);

create table if not exists public.leaderboard (
  user_id text primary key,
  xp_total bigint not null default 0,
  rank_name text,
  weekly_xp bigint not null default 0,
  season text,
  updated_at timestamptz not null default now()
);

create table if not exists public.streak_shields (
  user_id text primary key,
  shields_remaining int not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.user_badges (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  badge_type text not null,
  earned_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_leaderboard_xp_total on public.leaderboard (xp_total desc);
create index if not exists idx_leaderboard_weekly_xp on public.leaderboard (weekly_xp desc);
create index if not exists idx_leaderboard_user_id on public.leaderboard (user_id);
create index if not exists idx_daily_quests_user_id on public.daily_quests (user_id, expires_at);

-- RLS Enablement
alter table public.gamification_profiles enable row level security;
alter table public.daily_quests enable row level security;
alter table public.user_titles enable row level security;
alter table public.user_emotes enable row level security;
alter table public.user_frames enable row level security;
alter table public.leaderboard enable row level security;
alter table public.streak_shields enable row level security;
alter table public.user_badges enable row level security;

-- Setup Realtime on Leaderboard
begin;
  -- Remove the supabase_realtime publication if it exists so we can recreate it, or just alter it
  drop publication if exists supabase_realtime;
  create publication supabase_realtime;
commit;

alter publication supabase_realtime add table public.leaderboard;
alter publication supabase_realtime add table public.gamification_profiles;
  alter table public.leaderboard replica identity full;
  alter table public.gamification_profiles replica identity full;

-- ==========================================
-- SAMPLE DATA FOR LEADERBOARD
-- ==========================================

-- Insert dummy profiles
insert into public.gamification_profiles (user_id, xp, level, streak)
values 
  ('Omkar', 14500, 15, 12),
  ('Reeven', 32000, 31, 45),
  ('Siddharth', 8500, 9, 3),
  ('Aniket', 5200, 6, 1),
  ('Pranav', 47000, 48, 100)
on conflict (user_id) do nothing;

-- Insert dummy leaderboard ranks
insert into public.leaderboard (user_id, xp_total, rank_name)
values 
  ('Omkar', 14500, 'Elite'),
  ('Reeven', 32000, 'Master'),
  ('Siddharth', 8500, 'Tactician'),
  ('Aniket', 5200, 'Scholar'),
  ('Pranav', 47000, 'Legend')
on conflict (user_id) do nothing;
