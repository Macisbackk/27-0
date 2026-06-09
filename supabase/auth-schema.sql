-- Run in Supabase SQL editor for auth, profiles, stats, and leaderboard linking.

-- ─── Profiles ───────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  coach_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Public read profiles" on public.profiles;
create policy "Public read profiles"
  on public.profiles for select using (true);

drop policy if exists "Users insert own profile" on public.profiles;
create policy "Users insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile"
  on public.profiles for update using (auth.uid() = id);

-- ─── User stats (bundle row stores full JSON per difficulty) ────────────────
create table if not exists public.user_stats (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null,
  stat_key text not null,
  stat_value integer not null default 0,
  stat_json jsonb,
  updated_at timestamptz not null default now(),
  unique (user_id, mode, stat_key)
);

create index if not exists user_stats_user_mode_idx
  on public.user_stats (user_id, mode);

alter table public.user_stats enable row level security;

drop policy if exists "Users read own stats" on public.user_stats;
create policy "Users read own stats"
  on public.user_stats for select using (auth.uid() = user_id);

drop policy if exists "Users insert own stats" on public.user_stats;
create policy "Users insert own stats"
  on public.user_stats for insert with check (auth.uid() = user_id);

drop policy if exists "Users update own stats" on public.user_stats;
create policy "Users update own stats"
  on public.user_stats for update using (auth.uid() = user_id);

drop policy if exists "Users delete own stats" on public.user_stats;
create policy "Users delete own stats"
  on public.user_stats for delete using (auth.uid() = user_id);

-- ─── Leaderboard alterations ────────────────────────────────────────────────
alter table public.leaderboard add column if not exists user_id uuid references auth.users(id);
alter table public.leaderboard add column if not exists coach_name text;

-- Backfill coach_name from legacy player_name if present
update public.leaderboard
set coach_name = player_name
where coach_name is null and player_name is not null;

create index if not exists leaderboard_user_id_idx on public.leaderboard (user_id);
create index if not exists leaderboard_coach_name_idx on public.leaderboard (coach_name);

-- Ensure RLS on leaderboard (public read, authenticated insert own)
alter table public.leaderboard enable row level security;

drop policy if exists "Allow public read leaderboard" on public.leaderboard;
create policy "Allow public read leaderboard"
  on public.leaderboard for select using (true);

drop policy if exists "Allow public insert leaderboard" on public.leaderboard;
drop policy if exists "Authenticated insert own leaderboard" on public.leaderboard;
create policy "Authenticated insert own leaderboard"
  on public.leaderboard for insert
  with check (auth.uid() = user_id);

-- ─── Auto-create profile trigger (optional safety net) ──────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, coach_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'coach_name', 'Coach')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
