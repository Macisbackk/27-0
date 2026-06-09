-- Run in Supabase SQL editor if the leaderboard table needs mode/difficulty/wins/losses.
-- Safe to run multiple times (uses IF NOT EXISTS / conditional alters).

create table if not exists public.leaderboard (
  id uuid primary key default gen_random_uuid(),
  player_name text not null,
  score integer not null,
  created_at timestamptz not null default now()
);

alter table public.leaderboard add column if not exists mode text;
alter table public.leaderboard add column if not exists difficulty text;
alter table public.leaderboard add column if not exists wins integer;
alter table public.leaderboard add column if not exists losses integer;

update public.leaderboard set mode = 'super-league' where mode is null;
update public.leaderboard set difficulty = 'NORMAL' where difficulty is null;
update public.leaderboard set wins = 0 where wins is null;
update public.leaderboard set losses = 0 where losses is null;

create index if not exists leaderboard_mode_difficulty_score_idx
  on public.leaderboard (mode, difficulty, score desc);

create index if not exists leaderboard_created_at_idx
  on public.leaderboard (created_at desc);

-- Allow anonymous inserts/selects (adjust RLS for production as needed)
alter table public.leaderboard enable row level security;

drop policy if exists "Allow public read leaderboard" on public.leaderboard;
create policy "Allow public read leaderboard"
  on public.leaderboard for select using (true);

drop policy if exists "Allow public insert leaderboard" on public.leaderboard;
create policy "Allow public insert leaderboard"
  on public.leaderboard for insert with check (true);
