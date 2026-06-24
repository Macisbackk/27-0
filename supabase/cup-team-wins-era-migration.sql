-- Era Challenge Cup team wins — separate from Current via mode_variant.
-- Safe to run multiple times.

alter table public.cup_team_wins
  add column if not exists mode_variant text;

update public.cup_team_wins
set mode_variant = 'current'
where mode_variant is null;

alter table public.cup_team_wins
  alter column mode_variant set default 'current';

alter table public.cup_team_wins
  alter column mode_variant set not null;

-- Replace single-column PK with composite (team_name, mode_variant).
alter table public.cup_team_wins drop constraint if exists cup_team_wins_pkey;

alter table public.cup_team_wins
  add constraint cup_team_wins_pkey primary key (team_name, mode_variant);

create index if not exists cup_team_wins_variant_wins_idx
  on public.cup_team_wins (mode_variant, tournament_wins desc, last_won_at desc);

-- Dedupe table — one increment per completed tournament run.
create table if not exists public.cup_team_win_events (
  run_id text primary key,
  team_name text not null,
  mode_variant text not null default 'current',
  created_at timestamptz not null default now()
);

alter table public.cup_team_win_events enable row level security;

drop policy if exists "Allow public read cup team win events" on public.cup_team_win_events;
create policy "Allow public read cup team win events"
  on public.cup_team_win_events for select using (true);

drop policy if exists "Allow public insert cup team win events" on public.cup_team_win_events;
create policy "Allow public insert cup team win events"
  on public.cup_team_win_events for insert with check (true);

create or replace function public.increment_cup_team_win(
  p_team_name text,
  p_mode_variant text default 'current',
  p_run_id text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_team_name is null or btrim(p_team_name) = '' then
    return;
  end if;

  if p_mode_variant is null or btrim(p_mode_variant) = '' then
    p_mode_variant := 'current';
  end if;

  if p_run_id is not null and btrim(p_run_id) <> '' then
    if exists (
      select 1 from public.cup_team_win_events where run_id = p_run_id
    ) then
      return;
    end if;

    insert into public.cup_team_win_events (run_id, team_name, mode_variant)
    values (p_run_id, p_team_name, p_mode_variant);
  end if;

  insert into public.cup_team_wins (team_name, mode_variant, tournament_wins, last_won_at, updated_at)
  values (p_team_name, p_mode_variant, 1, now(), now())
  on conflict (team_name, mode_variant) do update
  set tournament_wins = public.cup_team_wins.tournament_wins + 1,
      last_won_at = now(),
      updated_at = now();
end;
$$;

grant execute on function public.increment_cup_team_win(text, text, text) to anon, authenticated;
