-- Run in Supabase SQL editor to create or extend the leaderboard table.
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
alter table public.leaderboard add column if not exists coach_name text;
alter table public.leaderboard add column if not exists user_id uuid;
alter table public.leaderboard add column if not exists perfect_runs integer;
alter table public.leaderboard add column if not exists best_record_wins integer;
alter table public.leaderboard add column if not exists best_record_losses integer;
alter table public.leaderboard add column if not exists best_win_percentage numeric;
alter table public.leaderboard add column if not exists challenge_cup_wins integer;
alter table public.leaderboard add column if not exists cup_finals integer;
alter table public.leaderboard add column if not exists best_cup_finish text;
alter table public.leaderboard add column if not exists best_cup_finish_rank integer;
alter table public.leaderboard add column if not exists cup_win_percentage numeric;
alter table public.leaderboard add column if not exists mode_variant text default 'current';

update public.leaderboard set mode = 'super-league' where mode is null;
-- Valid mode values: super-league, challenge-cup, draft
update public.leaderboard set difficulty = 'NORMAL' where difficulty is null;
update public.leaderboard set wins = 0 where wins is null;
update public.leaderboard set losses = 0 where losses is null;
update public.leaderboard set perfect_runs = 0 where perfect_runs is null;
update public.leaderboard set best_record_wins = coalesce(best_record_wins, wins, 0) where best_record_wins is null;
update public.leaderboard set best_record_losses = coalesce(best_record_losses, losses, 0) where best_record_losses is null;
update public.leaderboard set best_win_percentage = 0 where best_win_percentage is null;
update public.leaderboard set challenge_cup_wins = 0 where challenge_cup_wins is null;
update public.leaderboard set cup_finals = 0 where cup_finals is null;
update public.leaderboard set best_cup_finish_rank = 0 where best_cup_finish_rank is null;
update public.leaderboard set cup_win_percentage = 0 where cup_win_percentage is null;
update public.leaderboard set coach_name = player_name where coach_name is null;

update public.leaderboard set mode_variant = 'current' where mode_variant is null;

create index if not exists leaderboard_mode_difficulty_score_idx
  on public.leaderboard (mode, difficulty, score desc);

create index if not exists leaderboard_mode_difficulty_wins_idx
  on public.leaderboard (mode, difficulty, wins desc);

create index if not exists leaderboard_mode_difficulty_perfect_idx
  on public.leaderboard (mode, difficulty, perfect_runs desc);

create index if not exists leaderboard_mode_difficulty_variant_score_idx
  on public.leaderboard (mode, difficulty, mode_variant, score desc);

create index if not exists leaderboard_mode_difficulty_variant_wins_idx
  on public.leaderboard (mode, difficulty, mode_variant, wins desc);

create index if not exists leaderboard_mode_difficulty_variant_perfect_idx
  on public.leaderboard (mode, difficulty, mode_variant, perfect_runs desc);

create index if not exists leaderboard_created_at_idx
  on public.leaderboard (created_at desc);

-- One row per coach per mode + difficulty + variant (Current vs Era for Super League)
drop index if exists leaderboard_user_mode_difficulty_uidx;
create unique index if not exists leaderboard_user_mode_difficulty_variant_uidx
  on public.leaderboard (user_id, mode, difficulty, mode_variant)
  where user_id is not null;

alter table public.leaderboard enable row level security;

drop policy if exists "Allow public read leaderboard" on public.leaderboard;
create policy "Allow public read leaderboard"
  on public.leaderboard for select using (true);

drop policy if exists "Allow public insert leaderboard" on public.leaderboard;
create policy "Allow public insert leaderboard"
  on public.leaderboard for insert with check (true);

drop policy if exists "Allow public update leaderboard" on public.leaderboard;
create policy "Allow public update leaderboard"
  on public.leaderboard for update using (true);
