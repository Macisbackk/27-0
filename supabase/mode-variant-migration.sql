-- Normal Mode Current/Era leaderboard separation.
-- Safe to run multiple times.

alter table public.leaderboard add column if not exists mode_variant text;

update public.leaderboard
set mode_variant = 'current'
where mode_variant is null;

alter table public.leaderboard
  alter column mode_variant set default 'current';

-- Replace unique index so Current and Era Super League rows are separate per user.
drop index if exists public.leaderboard_user_mode_difficulty_uidx;

create unique index if not exists leaderboard_user_mode_difficulty_variant_uidx
  on public.leaderboard (user_id, mode, difficulty, mode_variant)
  where user_id is not null;

create index if not exists leaderboard_mode_difficulty_variant_score_idx
  on public.leaderboard (mode, difficulty, mode_variant, score desc);

create index if not exists leaderboard_mode_difficulty_variant_wins_idx
  on public.leaderboard (mode, difficulty, mode_variant, wins desc);

create index if not exists leaderboard_mode_difficulty_variant_perfect_idx
  on public.leaderboard (mode, difficulty, mode_variant, perfect_runs desc);
