-- Challenge Cup team tournament wins — aggregated by selected club/team.
-- Safe to run multiple times.

create table if not exists public.cup_team_wins (
  team_name text primary key,
  tournament_wins integer not null default 0 check (tournament_wins >= 0),
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

-- Atomic increment for logged-in online submissions (avoids read-modify-write races).
create or replace function public.increment_cup_team_win(p_team_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_team_name is null or btrim(p_team_name) = '' then
    return;
  end if;

  insert into public.cup_team_wins (team_name, tournament_wins, last_won_at, updated_at)
  values (p_team_name, 1, now(), now())
  on conflict (team_name) do update
  set tournament_wins = public.cup_team_wins.tournament_wins + 1,
      last_won_at = now(),
      updated_at = now();
end;
$$;

grant execute on function public.increment_cup_team_win(text) to anon, authenticated;
