-- 2026-10-27 — Weekly / Daily challenge scores through validating RPCs (v1.18)
-- APPLIED 2026-10-26 (split into challenge_rpcs_1_shared / 2_weekly / 3_daily; ledger cleanup line removed).
-- back to the old direct Weekly insert while they are missing; once this runs, direct writes to
-- weekly_challenge_entries are revoked, so a pre-v1.18 client can no longer post Weekly scores.
--
-- No DROP statements: everything is `create ... if not exists` / `create or replace`, and
-- policies are created inside existence checks.
--
-- What this does
--   1. submit_weekly_challenge_entry(...): the only way to write a Weekly score.
--      * signed-in caller only; the row is always the caller's (auth.uid()), never a passed id;
--      * the score is computed here from the per-round results (10 a win, +50 League Leaders,
--        15 a play-off win, +100 Grand Final) — the client no longer sends a score;
--      * structural checks the season format makes certain: 0–27 wins, 0–3 play-off wins, a
--        Grand Final needs 2+ play-off wins (semi + final), League Leaders get a bye so win at
--        most 2 play-off games, a regular-season (not final) entry carries no play-off result;
--      * current UK week only; one run per coach per week; the play-off result can be added
--        once, to the same run (the existing weekly guard trigger still enforces this);
--      * rate limit: 6 submissions per coach per 10 minutes (errcode 54000, retry later);
--      * plausibility flags (not rejections): a 27-0 season, League Leaders with fewer than 14
--        wins. Flagged rows stay on the board with flagged = true for review.
--   2. daily_challenge_entries + submit_daily_challenge_entry(...): the Daily board ranked by
--      the day's Daily score (same formula), same checks, keyed by UK day. Today or yesterday
--      only (a run started before midnight may finish after it).
--   3. challenge_submission_log: the rate-limit ledger (no client access).
--
-- Limits (documented on purpose): the server cannot re-simulate the season. The sim and the
-- draft run in the browser (seeded, but with picks and respins the server never sees), so a
-- determined cheater can still submit any *structurally valid* result. These RPCs stop
-- impossible scores, score/formula tampering, posting for other users, replays and floods, and
-- flag the suspicious ones. Full verification would need the squad + pick log submitted and an
-- edge function re-running the deterministic sim (future work).

begin;

-- ------------------------------------------------------------------------------------------
-- Rate-limit ledger
-- ------------------------------------------------------------------------------------------
create table if not exists public.challenge_submission_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('weekly', 'daily')),
  created_at timestamptz not null default now()
);

create index if not exists challenge_submission_log_user_idx
  on public.challenge_submission_log (user_id, kind, created_at desc);

alter table public.challenge_submission_log enable row level security;
revoke all on table public.challenge_submission_log from anon, authenticated;

create or replace function public.challenge_submission_allowed(p_user_id uuid, p_kind text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent integer;
begin
  select count(*) into recent
  from public.challenge_submission_log
  where user_id = p_user_id
    and kind = p_kind
    and created_at > now() - interval '10 minutes';
  if recent >= 6 then
    return false;
  end if;
  insert into public.challenge_submission_log (user_id, kind) values (p_user_id, p_kind);
  return true;
end;
$$;

revoke execute on function public.challenge_submission_allowed(uuid, text) from public, anon, authenticated;

-- Shared structural checks + score. Raises check_violation (23514) on an impossible result.
create or replace function public.challenge_validated_score(
  p_regular_wins integer,
  p_league_leaders boolean,
  p_playoff_wins integer,
  p_grand_final boolean,
  p_is_final boolean
)
returns integer
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_regular_wins is null or p_regular_wins < 0 or p_regular_wins > 27 then
    raise exception 'challenge: regular wins out of range' using errcode = 'check_violation';
  end if;
  if p_playoff_wins is null or p_playoff_wins < 0 or p_playoff_wins > 3 then
    raise exception 'challenge: play-off wins out of range' using errcode = 'check_violation';
  end if;
  if not coalesce(p_is_final, false) and (p_playoff_wins > 0 or coalesce(p_grand_final, false)) then
    raise exception 'challenge: a regular-season entry has no play-off result' using errcode = 'check_violation';
  end if;
  if coalesce(p_grand_final, false) and p_playoff_wins < 2 then
    raise exception 'challenge: a Grand Final win needs a semi-final win first' using errcode = 'check_violation';
  end if;
  if coalesce(p_league_leaders, false) and p_playoff_wins > 2 then
    raise exception 'challenge: League Leaders have a bye (max 2 play-off wins)' using errcode = 'check_violation';
  end if;
  return p_regular_wins * 10
    + p_playoff_wins * 15
    + (case when coalesce(p_grand_final, false) then 100 else 0 end)
    + (case when coalesce(p_league_leaders, false) then 50 else 0 end);
end;
$$;

revoke execute on function public.challenge_validated_score(integer, boolean, integer, boolean, boolean) from public, anon, authenticated;

create or replace function public.challenge_flag_reason(p_regular_wins integer, p_league_leaders boolean)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_regular_wins >= 27 then 'perfect season'
    when p_league_leaders and p_regular_wins < 14 then 'league leaders with few wins'
    else null
  end;
$$;

revoke execute on function public.challenge_flag_reason(integer, boolean) from public, anon, authenticated;

-- ------------------------------------------------------------------------------------------
-- Weekly
-- ------------------------------------------------------------------------------------------
alter table public.weekly_challenge_entries add column if not exists flagged boolean not null default false;
alter table public.weekly_challenge_entries add column if not exists flag_reason text;

create or replace function public.submit_weekly_challenge_entry(
  p_week_key text,
  p_run_id text,
  p_coach_name text,
  p_regular_wins integer,
  p_league_leaders boolean,
  p_playoff_wins integer,
  p_grand_final boolean,
  p_is_final boolean
)
returns table (score integer, is_final boolean, flagged boolean)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  uid uuid := auth.uid();
  current_week text := public.weekly_challenge_current_week_key();
  computed integer;
  reason text;
  existing public.weekly_challenge_entries%rowtype;
begin
  if uid is null then
    raise exception 'weekly challenge: sign in to submit' using errcode = 'insufficient_privilege';
  end if;
  if p_week_key is distinct from current_week then
    raise exception 'weekly challenge: % is not the current week (%)', p_week_key, current_week
      using errcode = 'check_violation';
  end if;
  if p_run_id is null or char_length(p_run_id) not between 1 and 120 then
    raise exception 'weekly challenge: bad run id' using errcode = 'check_violation';
  end if;
  if p_coach_name is null or char_length(p_coach_name) not between 1 and 32 then
    raise exception 'weekly challenge: bad coach name' using errcode = 'check_violation';
  end if;
  if not public.challenge_submission_allowed(uid, 'weekly') then
    raise exception 'weekly challenge: too many submissions, try again shortly'
      using errcode = 'program_limit_exceeded';
  end if;

  computed := public.challenge_validated_score(
    p_regular_wins, p_league_leaders, p_playoff_wins, p_grand_final, p_is_final);
  reason := public.challenge_flag_reason(p_regular_wins, p_league_leaders);

  select * into existing
  from public.weekly_challenge_entries e
  where e.week_key = p_week_key and e.user_id = uid;

  if not found then
    insert into public.weekly_challenge_entries as e (
      week_key, user_id, coach_name, run_id, regular_wins, league_leaders,
      playoff_wins, grand_final, score, is_final, flagged, flag_reason
    ) values (
      p_week_key, uid, p_coach_name, p_run_id, p_regular_wins, coalesce(p_league_leaders, false),
      p_playoff_wins, coalesce(p_grand_final, false), computed, coalesce(p_is_final, false),
      reason is not null, reason
    );
  elsif existing.run_id <> p_run_id then
    raise exception 'weekly challenge: this week''s ranked attempt is already on the board'
      using errcode = 'check_violation';
  elsif existing.is_final then
    -- Same run, already complete: nothing to change (idempotent retry).
    null;
  elsif coalesce(p_is_final, false) then
    if existing.regular_wins <> p_regular_wins or existing.league_leaders <> coalesce(p_league_leaders, false) then
      raise exception 'weekly challenge: only the play-off result can be added'
        using errcode = 'check_violation';
    end if;
    update public.weekly_challenge_entries e
    set playoff_wins = p_playoff_wins,
        grand_final = coalesce(p_grand_final, false),
        score = computed,
        is_final = true,
        flagged = e.flagged or reason is not null,
        flag_reason = coalesce(e.flag_reason, reason)
    where e.week_key = p_week_key and e.user_id = uid and e.run_id = p_run_id and not e.is_final;
  end if;

  return query
    select e.score, e.is_final, e.flagged
    from public.weekly_challenge_entries e
    where e.week_key = p_week_key and e.user_id = uid;
end;
$$;

revoke execute on function public.submit_weekly_challenge_entry(text, text, text, integer, boolean, integer, boolean, boolean) from public, anon;
grant execute on function public.submit_weekly_challenge_entry(text, text, text, integer, boolean, integer, boolean, boolean) to authenticated;

-- Writes now go through the RPC only (it runs as the table owner). Reads stay public.
revoke insert, update on table public.weekly_challenge_entries from anon, authenticated;

-- ------------------------------------------------------------------------------------------
-- Daily
-- ------------------------------------------------------------------------------------------
create or replace function public.daily_challenge_current_day_key()
returns text
language sql
stable
set search_path = ''
as $$
  select to_char((now() at time zone 'Europe/London')::date, 'YYYY-MM-DD');
$$;

create table if not exists public.daily_challenge_entries (
  day_key text not null check (day_key ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  user_id uuid not null references auth.users (id) on delete cascade,
  coach_name text not null check (char_length(coach_name) between 1 and 32),
  run_id text not null check (char_length(run_id) between 1 and 120),
  regular_wins smallint not null check (regular_wins between 0 and 27),
  league_leaders boolean not null default false,
  playoff_wins smallint not null default 0 check (playoff_wins between 0 and 3),
  grand_final boolean not null default false,
  score integer not null,
  is_final boolean not null default false,
  flagged boolean not null default false,
  flag_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (day_key, user_id),
  constraint daily_challenge_entries_score_formula check (
    score = regular_wins * 10
      + playoff_wins * 15
      + (case when grand_final then 100 else 0 end)
      + (case when league_leaders then 50 else 0 end)
  ),
  constraint daily_challenge_entries_grand_final_needs_wins check (not grand_final or playoff_wins >= 2)
);

create index if not exists daily_challenge_entries_board_idx
  on public.daily_challenge_entries (day_key, score desc, created_at asc);

create index if not exists daily_challenge_entries_user_idx
  on public.daily_challenge_entries (user_id);

-- Names: same moderation as the other boards (20261026120000_moderation.sql).
create or replace function public.daily_challenge_entries_moderate_name()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.coach_name_is_hidden(new.user_id) or not public.coach_name_is_allowed(new.coach_name) then
    new.coach_name := public.coach_name_masked(new.user_id, new.coach_name);
  end if;
  return new;
end;
$$;

revoke execute on function public.daily_challenge_entries_moderate_name() from public, anon, authenticated;

create or replace trigger daily_challenge_entries_moderate_name
  before insert or update on public.daily_challenge_entries
  for each row execute function public.daily_challenge_entries_moderate_name();

alter table public.daily_challenge_entries enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'daily_challenge_entries'
      and policyname = 'daily_challenge_entries_select_public'
  ) then
    create policy "daily_challenge_entries_select_public"
      on public.daily_challenge_entries for select
      to anon, authenticated
      using (true);
  end if;
end;
$$;

revoke all on table public.daily_challenge_entries from anon, authenticated;
grant select on table public.daily_challenge_entries to anon, authenticated;

create or replace function public.submit_daily_challenge_entry(
  p_day_key text,
  p_run_id text,
  p_coach_name text,
  p_regular_wins integer,
  p_league_leaders boolean,
  p_playoff_wins integer,
  p_grand_final boolean,
  p_is_final boolean
)
returns table (score integer, is_final boolean, flagged boolean)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  uid uuid := auth.uid();
  today text := public.daily_challenge_current_day_key();
  yesterday text := to_char((now() at time zone 'Europe/London')::date - 1, 'YYYY-MM-DD');
  computed integer;
  reason text;
  existing public.daily_challenge_entries%rowtype;
begin
  if uid is null then
    raise exception 'daily challenge: sign in to submit' using errcode = 'insufficient_privilege';
  end if;
  if p_day_key is null or p_day_key not in (today, yesterday) then
    raise exception 'daily challenge: % is closed', p_day_key using errcode = 'check_violation';
  end if;
  if p_run_id is null or char_length(p_run_id) not between 1 and 120 then
    raise exception 'daily challenge: bad run id' using errcode = 'check_violation';
  end if;
  if p_coach_name is null or char_length(p_coach_name) not between 1 and 32 then
    raise exception 'daily challenge: bad coach name' using errcode = 'check_violation';
  end if;
  if not public.challenge_submission_allowed(uid, 'daily') then
    raise exception 'daily challenge: too many submissions, try again shortly'
      using errcode = 'program_limit_exceeded';
  end if;

  computed := public.challenge_validated_score(
    p_regular_wins, p_league_leaders, p_playoff_wins, p_grand_final, p_is_final);
  reason := public.challenge_flag_reason(p_regular_wins, p_league_leaders);

  select * into existing
  from public.daily_challenge_entries e
  where e.day_key = p_day_key and e.user_id = uid;

  if not found then
    insert into public.daily_challenge_entries (
      day_key, user_id, coach_name, run_id, regular_wins, league_leaders,
      playoff_wins, grand_final, score, is_final, flagged, flag_reason
    ) values (
      p_day_key, uid, p_coach_name, p_run_id, p_regular_wins, coalesce(p_league_leaders, false),
      p_playoff_wins, coalesce(p_grand_final, false), computed, coalesce(p_is_final, false),
      reason is not null, reason
    );
  elsif existing.run_id <> p_run_id then
    raise exception 'daily challenge: today''s counted attempt is already on the board'
      using errcode = 'check_violation';
  elsif existing.is_final then
    null;
  elsif coalesce(p_is_final, false) then
    if existing.regular_wins <> p_regular_wins or existing.league_leaders <> coalesce(p_league_leaders, false) then
      raise exception 'daily challenge: only the play-off result can be added'
        using errcode = 'check_violation';
    end if;
    update public.daily_challenge_entries e
    set playoff_wins = p_playoff_wins,
        grand_final = coalesce(p_grand_final, false),
        score = computed,
        is_final = true,
        flagged = e.flagged or reason is not null,
        flag_reason = coalesce(e.flag_reason, reason),
        updated_at = now()
    where e.day_key = p_day_key and e.user_id = uid and e.run_id = p_run_id and not e.is_final;
  end if;

  return query
    select e.score, e.is_final, e.flagged
    from public.daily_challenge_entries e
    where e.day_key = p_day_key and e.user_id = uid;
end;
$$;

revoke execute on function public.submit_daily_challenge_entry(text, text, text, integer, boolean, integer, boolean, boolean) from public, anon;
grant execute on function public.submit_daily_challenge_entry(text, text, text, integer, boolean, integer, boolean, boolean) to authenticated;

commit;
