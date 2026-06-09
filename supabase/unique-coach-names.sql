-- Unique coach names (case-insensitive) + one leaderboard row per user/mode/difficulty.
-- Run in Supabase SQL Editor after auth-schema.sql and leaderboard-schema.sql.

-- ─── Globally unique coach names ─────────────────────────────────────────────
create unique index if not exists profiles_coach_name_lower_unique
  on public.profiles (lower(coach_name));

-- ─── One best leaderboard entry per user per mode/difficulty ─────────────────
alter table public.leaderboard add column if not exists user_id uuid references auth.users(id);
alter table public.leaderboard add column if not exists coach_name text;

create unique index if not exists leaderboard_user_mode_difficulty_unique
  on public.leaderboard (user_id, mode, difficulty)
  where user_id is not null;

-- Allow users to update their own leaderboard row when beating a previous score
drop policy if exists "Users update own leaderboard" on public.leaderboard;
create policy "Users update own leaderboard"
  on public.leaderboard for update
  using (auth.uid() = user_id);
