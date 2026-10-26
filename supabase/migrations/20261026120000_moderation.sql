-- 2026-10-26 — Coach-name moderation, reports and auto-hide (App Store Guideline 1.2)
-- NOT YET APPLIED. Run once in the Supabase SQL editor (or via apply_migration).
-- Safe on the live data: nothing here re-checks existing rows. Every check runs only when a row is
-- inserted or its name changes, and leaderboard names that fail are masked, never rejected.
--
-- What it adds:
--   1. public.coach_name_is_allowed(text): the SQL copy of src/lib/moderation (same word lists —
--      scripts/test-name-filter.ts checks they match; simpler normalisation: leetspeak, repeated
--      letters, camelCase / underscore words; no cross-word matching).
--   2. profiles: a new or changed coach_name that fails is rejected (check_violation,
--      'coach name not allowed'). New columns name_hidden / name_hidden_at, which players can't
--      change themselves.
--   3. leaderboard + weekly_challenge_entries: on insert / update a name that fails, or belongs to a
--      coach whose name is hidden, is stored as "Coach #1234" (public.coach_name_masked). Scores
--      are untouched.
--   4. content_reports: signed-in players report a coach (offensive name / cheating / other).
--      Insert-own only, no read access for players, one report per reporter per coach per UTC day,
--      at most 20 reports per reporter per day.
--   5. Auto-hide: 3 distinct reporters (unreviewed, not 'cheating') hide the name everywhere until
--      reviewed. Review steps: docs/MODERATION.md.

begin;

-- ---------------------------------------------------------------------------------------------
-- 1. Name filter
-- ---------------------------------------------------------------------------------------------

create or replace function public.coach_name_is_allowed(p_name text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  blocked_substrings constant text[] := array[
    'fuck', 'fuk', 'fck', 'fcuk', 'fvck', 'phuck', 'phuk', 'fuq', 'cunt', 'kunt', 'shit',
    'shyt', 'wank', 'bollock', 'bollox', 'bastard', 'bitch', 'biatch', 'twat', 'tosser',
    'tosspot', 'bellend', 'knobhead', 'nobhead', 'knobend', 'dickhead', 'dickface', 'dicksuck',
    'dickpic', 'bigdick', 'mydick', 'suckmydick', 'cocksuck', 'cockhead', 'bigcock', 'mycock',
    'asshole', 'arsehole', 'arsewipe', 'dumbass', 'jackass', 'fatass', 'asshat', 'assclown',
    'asswipe', 'pisshead', 'pissflaps', 'motherf', 'bugger', 'shithead', 'pussy', 'penis',
    'vagina', 'dildo', 'porn', 'jizz', 'spunk', 'boob', 'blowjob', 'handjob', 'rimjob',
    'cumshot', 'cumslut', 'creampie', 'gangbang', 'bukkake', 'deepthroat', 'orgasm', 'horny',
    'erection', 'masturbat', 'hentai', 'nudes', 'whore', 'slut', 'skank', 'rapist', 'paedo',
    'pedophil', 'paedophil', 'incest', 'bestiality', 'nigger', 'nigga', 'niggah', 'nigguh',
    'faggot', 'fagot', 'retard', 'spastic', 'spacker', 'spakka', 'tranny', 'shemale',
    'poofter', 'battyboy', 'battyman', 'golliwog', 'raghead', 'towelhead', 'wetback', 'beaner',
    'gyppo', 'pikey', 'windowlicker', 'hitler', 'siegheil', 'heilhitler', 'nazis',
    'jihadijohn', 'jihadjohn', 'binladen'
  ];
  blocked_words constant text[] := array[
    'ass', 'arse', 'cock', 'prick', 'piss', 'crap', 'tit', 'tits', 'titty', 'knob', 'nob',
    'minge', 'fanny', 'slag', 'bint', 'shag', 'cum', 'anal', 'anus', 'clit', 'sex', 'nonce',
    'pedo', 'rape', 'raping', 'boner', 'milf', 'jerkoff', 'fag', 'fags', 'faggy', 'spaz',
    'spazz', 'mong', 'paki', 'pakis', 'coon', 'chink', 'gook', 'kike', 'spic', 'spick', 'wog',
    'wop', 'yid', 'taig', 'negro', 'sambo', 'dyke', 'lesbo', 'homo', 'poof', 'nazi', 'kkk',
    'gypo', 'gippo'
  ];
  allowed_substrings constant text[] := array[
    'scunthorpe', 'penistone', 'therapist', 'swank', 'shitake'
  ];
  allowed_tokens constant text[] := array[
    'cocky', 'cocker', 'cockers', 'nobby', 'nobbys', 'nobbies', 'spicy', 'spicer', 'spicers',
    'cumming', 'cummings', 'shaggy', 'monger', 'mongers', 'dykes', 'fages'
  ];
  sub_re text;
  word_re text;
  allow_re text;
  s text;
  tok text;
begin
  if p_name is null or p_name = '' then
    return true;
  end if;
  -- The stand-in made by coach_name_masked().
  if p_name ~ '^Coach #[0-9]{4}$' then
    return true;
  end if;
  if position('1488' in p_name) > 0 then
    return false;
  end if;

  -- Each letter may repeat: 'fuck' -> 'f+u+c+k+'.
  select string_agg(regexp_replace(t, '(.)', '\1+', 'g'), '|') into sub_re from unnest(blocked_substrings) t;
  select '^(' || string_agg(regexp_replace(t, '(.)', '\1+', 'g'), '|') || ')(s|es|ed|d|er|ers|ing|y|ie|ies|z)?$'
    into word_re from unnest(blocked_words) t;
  allow_re := array_to_string(allowed_substrings, '|');

  -- camelCase -> words, leetspeak -> letters, anything else separates words.
  s := regexp_replace(p_name, '([a-z])([A-Z])', '\1 \2', 'g');
  s := lower(translate(s, '01345789@$!+|', 'oieastbgasiti'));
  s := btrim(regexp_replace(s, '[^a-z]+', ' ', 'g'));
  if s = '' then
    return true;
  end if;

  foreach tok in array regexp_split_to_array(s, ' ') loop
    tok := regexp_replace(tok, allow_re, '#', 'g');
    if tok ~ sub_re then
      return false;
    end if;
    if not (tok = any (allowed_tokens)) and tok ~ word_re then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

-- "Coach #1234": first 8 hex digits of the user id mod 10000 (maskedCoachName() in name-filter.ts).
create or replace function public.coach_name_masked(p_user_id uuid, p_name text default null)
returns text
language sql
immutable
set search_path = ''
as $$
  select 'Coach #' || lpad((
    (('x' || substr(
      case when p_user_id is not null then replace(p_user_id::text, '-', '') else md5(coalesce(p_name, '')) end,
      1, 8))::bit(32)::bigint) % 10000
  )::text, 4, '0');
$$;

grant execute on function public.coach_name_is_allowed(text) to anon, authenticated;
grant execute on function public.coach_name_masked(uuid, text) to anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 2. profiles: block new / changed names; moderation flag
-- ---------------------------------------------------------------------------------------------

alter table public.profiles
  add column if not exists name_hidden boolean not null default false,
  add column if not exists name_hidden_at timestamptz;

create or replace function public.profiles_moderation_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT' or new.coach_name is distinct from old.coach_name)
     and not public.coach_name_is_allowed(new.coach_name) then
    raise exception 'coach name not allowed' using errcode = 'check_violation', hint = 'coach_name_blocked';
  end if;
  -- Players can't hide or unhide their own name; only moderation (owner / security definer) can.
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.name_hidden := false;
      new.name_hidden_at := null;
    else
      new.name_hidden := old.name_hidden;
      new.name_hidden_at := old.name_hidden_at;
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.profiles_moderation_guard() from public, anon, authenticated;

drop trigger if exists profiles_moderation_guard on public.profiles;
create trigger profiles_moderation_guard
  before insert or update on public.profiles
  for each row execute function public.profiles_moderation_guard();

-- ---------------------------------------------------------------------------------------------
-- 3. Leaderboard names: mask blocked or hidden names on write
-- ---------------------------------------------------------------------------------------------

create or replace function public.coach_name_is_hidden(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.name_hidden from public.profiles p where p.id = p_user_id), false);
$$;

revoke execute on function public.coach_name_is_hidden(uuid) from public, anon;
grant execute on function public.coach_name_is_hidden(uuid) to authenticated;

create or replace function public.leaderboard_moderate_name()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  hidden boolean := public.coach_name_is_hidden(new.user_id);
begin
  if new.coach_name is not null and (hidden or not public.coach_name_is_allowed(new.coach_name)) then
    new.coach_name := public.coach_name_masked(new.user_id, new.coach_name);
  end if;
  if new.player_name is not null and (hidden or not public.coach_name_is_allowed(new.player_name)) then
    new.player_name := public.coach_name_masked(new.user_id, new.player_name);
  end if;
  return new;
end;
$$;

revoke execute on function public.leaderboard_moderate_name() from public, anon, authenticated;

drop trigger if exists leaderboard_moderate_name on public.leaderboard;
create trigger leaderboard_moderate_name
  before insert or update on public.leaderboard
  for each row execute function public.leaderboard_moderate_name();

create or replace function public.weekly_challenge_entries_moderate_name()
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

revoke execute on function public.weekly_challenge_entries_moderate_name() from public, anon, authenticated;

drop trigger if exists weekly_challenge_entries_moderate_name on public.weekly_challenge_entries;
create trigger weekly_challenge_entries_moderate_name
  before insert or update on public.weekly_challenge_entries
  for each row execute function public.weekly_challenge_entries_moderate_name();

-- The Weekly guard (20261025120000_weekly_challenge.sql) refuses every update to a final or
-- closed-week entry. Same function, plus one exception: an update that only swaps coach_name for
-- that coach's "Coach #1234" stand-in (what moderation does) goes through. Harmless if a player
-- does it to their own row.
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

  -- Moderation: mask the name, nothing else.
  if new.coach_name = public.coach_name_masked(old.user_id, old.coach_name)
     and new.coach_name is distinct from old.coach_name
     and (new.week_key, new.user_id, new.run_id, new.regular_wins, new.league_leaders,
          new.playoff_wins, new.grand_final, new.score, new.is_final)
       is not distinct from
         (old.week_key, old.user_id, old.run_id, old.regular_wins, old.league_leaders,
          old.playoff_wins, old.grand_final, old.score, old.is_final) then
    new.created_at := old.created_at;
    new.updated_at := old.updated_at;
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

-- ---------------------------------------------------------------------------------------------
-- 4. Reports
-- ---------------------------------------------------------------------------------------------

create table if not exists public.content_reports (
  id bigint generated always as identity primary key,
  reporter_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  reported_user_id uuid not null references auth.users (id) on delete cascade,
  -- The name as the reporter saw it, and the reported coach's profile name when reported.
  coach_name text not null check (char_length(coach_name) between 1 and 64),
  profile_coach_name text,
  board text not null check (board ~ '^[a-z0-9_-]{1,40}$'),
  reason text not null check (reason in ('offensive_name', 'cheating', 'other')),
  details text check (details is null or char_length(details) <= 500),
  created_on date not null default ((now() at time zone 'utc')::date),
  created_at timestamptz not null default now(),
  -- Set by the owner when the report has been dealt with (docs/MODERATION.md).
  reviewed_at timestamptz,
  review_note text,
  constraint content_reports_not_self check (reporter_id <> reported_user_id),
  constraint content_reports_one_per_day unique (reporter_id, reported_user_id, created_on)
);

create index if not exists content_reports_open_idx
  on public.content_reports (reported_user_id)
  where reviewed_at is null;

create index if not exists content_reports_created_idx
  on public.content_reports (created_at desc);

-- Security definer: players can't read content_reports, so the daily cap must count as the owner.
create or replace function public.content_reports_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date := (now() at time zone 'utc')::date;
  sent integer;
begin
  new.created_at := now();
  new.created_on := today;
  new.reviewed_at := null;
  new.review_note := null;
  select p.coach_name into new.profile_coach_name from public.profiles p where p.id = new.reported_user_id;

  select count(*) into sent
    from public.content_reports r
   where r.reporter_id = new.reporter_id and r.created_on = today;
  if sent >= 20 then
    raise exception 'report limit reached for today' using errcode = 'check_violation', hint = 'report_rate_limited';
  end if;
  return new;
end;
$$;

revoke execute on function public.content_reports_before_insert() from public, anon, authenticated;

drop trigger if exists content_reports_before_insert on public.content_reports;
create trigger content_reports_before_insert
  before insert on public.content_reports
  for each row execute function public.content_reports_before_insert();

-- Mask one coach's name on every board (auto-hide, or by hand: select public.moderation_mask_coach('<uuid>')).
create or replace function public.moderation_mask_coach(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  masked text := public.coach_name_masked(p_user_id);
begin
  update public.profiles
     set name_hidden = true, name_hidden_at = coalesce(name_hidden_at, now())
   where id = p_user_id;
  update public.leaderboard
     set coach_name = masked, player_name = masked
   where user_id = p_user_id
     and (coach_name is distinct from masked or player_name is distinct from masked);
  update public.weekly_challenge_entries
     set coach_name = masked
   where user_id = p_user_id and coach_name is distinct from masked;
end;
$$;

revoke execute on function public.moderation_mask_coach(uuid) from public, anon, authenticated;

-- 5. Auto-hide: 3 distinct reporters with open, non-cheating reports.
create or replace function public.content_reports_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  reporters integer;
begin
  if new.reason = 'cheating' then
    return null;
  end if;
  select count(distinct r.reporter_id) into reporters
    from public.content_reports r
   where r.reported_user_id = new.reported_user_id
     and r.reviewed_at is null
     and r.reason <> 'cheating';
  if reporters >= 3 then
    perform public.moderation_mask_coach(new.reported_user_id);
  end if;
  return null;
end;
$$;

revoke execute on function public.content_reports_after_insert() from public, anon, authenticated;

drop trigger if exists content_reports_after_insert on public.content_reports;
create trigger content_reports_after_insert
  after insert on public.content_reports
  for each row execute function public.content_reports_after_insert();

alter table public.content_reports enable row level security;

drop policy if exists "content_reports_insert_own" on public.content_reports;
create policy "content_reports_insert_own"
  on public.content_reports for insert
  to authenticated
  with check ((select auth.uid()) = reporter_id and reported_user_id <> (select auth.uid()));

-- No select / update / delete policies: players can file reports but never read them.

revoke all on table public.content_reports from anon, authenticated;
grant insert on table public.content_reports to authenticated;

commit;
