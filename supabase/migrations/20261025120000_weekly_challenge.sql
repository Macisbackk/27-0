-- 2026-10-25 — Weekly Challenge board
-- NOT YET APPLIED. Run once in the Supabase SQL editor (or via apply_migration).
--
-- One row per coach per UK week (Monday 00:00 to Sunday 23:59 Europe/London), keyed by the
-- ISO week ("2026-W43", same as getWeeklyChallengeWeekKey in src/lib/weekly-challenge.ts).
--
-- Why a table of its own rather than a `leaderboard` row: the Weekly allows ONE ranked attempt,
-- and `leaderboard` lets the owner update and delete their row freely. Here the database holds
-- the line:
--   * insert: own row only, and only into the current UK week (no back-filling a closed week);
--   * update: own row only, once, to add the play-off result to the same run (is_final false ->
--     true); the regular-season part of the score is frozen at insert;
--   * delete: no policy (rows go with the account via ON DELETE CASCADE).
-- So a week's board is final the moment the week ends, which is what the client-side top-10
-- payout (storage/weekly-leaderboard.ts) relies on.
--
-- Read / write policies otherwise mirror the leaderboard's (2026-10-21-rls-and-function-hardening):
-- public select, authenticated own-row writes, auth.uid() wrapped in (select ...).

begin;

create or replace function public.weekly_challenge_current_week_key()
returns text
language sql
stable
set search_path = ''
as $$
  select to_char((now() at time zone 'Europe/London')::date, 'IYYY-"W"IW');
$$;

create table if not exists public.weekly_challenge_entries (
  week_key text not null check (week_key ~ '^[0-9]{4}-W[0-9]{2}$'),
  user_id uuid not null references auth.users (id) on delete cascade,
  coach_name text not null check (char_length(coach_name) between 1 and 32),
  run_id text not null check (char_length(run_id) between 1 and 120),
  regular_wins smallint not null check (regular_wins between 0 and 27),
  league_leaders boolean not null default false,
  playoff_wins smallint not null default 0 check (playoff_wins between 0 and 3),
  grand_final boolean not null default false,
  -- Mirrors WEEKLY_SCORE: 10 a win, 15 a play-off win, +100 Grand Final, +50 League Leaders.
  score integer not null,
  -- false while the play-offs are still to come for this run; true once the score is complete.
  is_final boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (week_key, user_id),
  constraint weekly_challenge_entries_score_formula check (
    score = regular_wins * 10
      + playoff_wins * 15
      + (case when grand_final then 100 else 0 end)
      + (case when league_leaders then 50 else 0 end)
  ),
  constraint weekly_challenge_entries_grand_final_needs_win check (not grand_final or playoff_wins >= 1)
);

-- Board order: score desc, earliest entry first on ties.
create index if not exists weekly_challenge_entries_board_idx
  on public.weekly_challenge_entries (week_key, score desc, created_at asc);

create index if not exists weekly_challenge_entries_user_idx
  on public.weekly_challenge_entries (user_id);

-- Server-side guards the RLS policies can't express (week window, one-shot finalise).
create or replace function public.weekly_challenge_entries_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  current_week text := public.weekly_challenge_current_week_key();
begin
  if tg_op = 'INSERT' then
    if new.week_key <> current_week then
      raise exception 'weekly challenge: % is not the current week (%)', new.week_key, current_week
        using errcode = 'check_violation';
    end if;
    new.created_at := now();
    new.updated_at := now();
    return new;
  end if;

  -- UPDATE: add the play-off result to the same run, once, before the week ends.
  if old.is_final then
    raise exception 'weekly challenge: entry already final' using errcode = 'check_violation';
  end if;
  if old.week_key <> current_week then
    raise exception 'weekly challenge: week % is closed', old.week_key using errcode = 'check_violation';
  end if;
  if new.week_key <> old.week_key
     or new.user_id <> old.user_id
     or new.run_id <> old.run_id
     or new.regular_wins <> old.regular_wins
     or new.league_leaders <> old.league_leaders then
    raise exception 'weekly challenge: only the play-off result can be added' using errcode = 'check_violation';
  end if;
  new.is_final := true;
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function public.weekly_challenge_entries_guard() from public, anon, authenticated;

drop trigger if exists weekly_challenge_entries_guard on public.weekly_challenge_entries;
create trigger weekly_challenge_entries_guard
  before insert or update on public.weekly_challenge_entries
  for each row execute function public.weekly_challenge_entries_guard();

alter table public.weekly_challenge_entries enable row level security;

drop policy if exists "weekly_challenge_entries_select_public" on public.weekly_challenge_entries;
create policy "weekly_challenge_entries_select_public"
  on public.weekly_challenge_entries for select
  to anon, authenticated
  using (true);

drop policy if exists "weekly_challenge_entries_insert_own" on public.weekly_challenge_entries;
create policy "weekly_challenge_entries_insert_own"
  on public.weekly_challenge_entries for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "weekly_challenge_entries_update_own" on public.weekly_challenge_entries;
create policy "weekly_challenge_entries_update_own"
  on public.weekly_challenge_entries for update
  to authenticated
  using ((select auth.uid()) = user_id and not is_final)
  with check ((select auth.uid()) = user_id);

-- No delete policy on purpose: deleting and re-inserting would be a second attempt.

revoke all on table public.weekly_challenge_entries from anon, authenticated;
grant select on table public.weekly_challenge_entries to anon, authenticated;
grant insert, update on table public.weekly_challenge_entries to authenticated;

commit;
