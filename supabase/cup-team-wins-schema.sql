-- Challenge Cup team tournament wins — aggregated by selected club/team.
-- Safe to run multiple times.

create table if not exists public.cup_team_wins (
  team_name text primary key,
  tournament_wins integer not null default 0,
  last_won_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists cup_team_wins_wins_idx
  on public.cup_team_wins (tournament_wins desc, last_won_at desc);

alter table public.cup_team_wins enable row level security;

drop policy if exists "Allow public read cup team wins" on public.cup_team_wins;
create policy "Allow public read cup team wins"
  on public.cup_team_wins for select using (true);

drop policy if exists "Allow public insert cup team wins" on public.cup_team_wins;
create policy "Allow public insert cup team wins"
  on public.cup_team_wins for insert with check (true);

drop policy if exists "Allow public update cup team wins" on public.cup_team_wins;
create policy "Allow public update cup team wins"
  on public.cup_team_wins for update using (true);
