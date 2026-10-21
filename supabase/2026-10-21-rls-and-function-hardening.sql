-- 2026-10-21 — RLS + function hardening
-- Applied to production via Supabase MCP on 2026-10-21. Kept here for reference / re-runs.
--
-- Fixes the Supabase advisor findings:
--   * SECURITY DEFINER functions executable by anon/authenticated (handle_new_user, increment_cup_team_win)
--   * leaderboard: leftover "public insert leaderboard" policy (WITH CHECK true) that let any
--     caller insert rows for any user_id — score forgery. The app only ever writes with the
--     signed-in user's id, so the authenticated-only policy is sufficient.
--   * Duplicate permissive policies on leaderboard / user_stats
--   * auth.uid() re-evaluated per row (wrap in (select ...))
--   * cup_team_wins / cup_team_win_events had public INSERT/UPDATE with no checks. The app does not
--     write to these tables from the client at all, so writes now go through service role only.

begin;

------------------------------------------------------------------------------
-- 1. Functions: not callable through the REST RPC endpoint
------------------------------------------------------------------------------
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.increment_cup_team_win(text) from public, anon, authenticated;
revoke execute on function public.increment_cup_team_win(text, text, text) from public, anon, authenticated;
-- Trigger on auth.users still fires (EXECUTE is only checked when the trigger is created).
-- Maintenance scripts using the service role key keep working:
grant execute on function public.increment_cup_team_win(text) to service_role;
grant execute on function public.increment_cup_team_win(text, text, text) to service_role;

------------------------------------------------------------------------------
-- 2. leaderboard
------------------------------------------------------------------------------
drop policy if exists "public insert leaderboard" on public.leaderboard;
drop policy if exists "public read leaderboard" on public.leaderboard;
drop policy if exists "Allow public read leaderboard" on public.leaderboard;
drop policy if exists "Authenticated insert own leaderboard" on public.leaderboard;
drop policy if exists "Authenticated update own leaderboard" on public.leaderboard;

create policy "leaderboard_select_public"
  on public.leaderboard for select
  to anon, authenticated
  using (true);

create policy "leaderboard_insert_own"
  on public.leaderboard for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "leaderboard_update_own"
  on public.leaderboard for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

------------------------------------------------------------------------------
-- 3. profiles
------------------------------------------------------------------------------
drop policy if exists "Public read profiles" on public.profiles;
drop policy if exists "Users insert own profile" on public.profiles;
drop policy if exists "Users update own profile" on public.profiles;

create policy "profiles_select_public"
  on public.profiles for select
  to anon, authenticated
  using (true);

create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

------------------------------------------------------------------------------
-- 4. user_stats
------------------------------------------------------------------------------
drop policy if exists "Users read own stats" on public.user_stats;
drop policy if exists "Public read club funds totals" on public.user_stats;
drop policy if exists "Users insert own stats" on public.user_stats;
drop policy if exists "Users update own stats" on public.user_stats;
drop policy if exists "Users delete own stats" on public.user_stats;

-- One SELECT policy: your own rows, plus the public club-funds totals used by the funds leaderboard.
create policy "user_stats_select"
  on public.user_stats for select
  to anon, authenticated
  using (
    (select auth.uid()) = user_id
    or (mode = 'GLOBAL' and stat_key = 'club_funds' and stat_value > 0)
  );

create policy "user_stats_insert_own"
  on public.user_stats for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "user_stats_update_own"
  on public.user_stats for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "user_stats_delete_own"
  on public.user_stats for delete
  to authenticated
  using ((select auth.uid()) = user_id);

------------------------------------------------------------------------------
-- 5. cup_team_wins / cup_team_win_events — read-only from the client
------------------------------------------------------------------------------
drop policy if exists "Allow public insert cup team wins" on public.cup_team_wins;
drop policy if exists "Allow public update cup team wins" on public.cup_team_wins;
drop policy if exists "Allow public insert cup team win events" on public.cup_team_win_events;
-- The single-arg overload is broken anyway (its ON CONFLICT target no longer exists) and unused.
drop function if exists public.increment_cup_team_win(text);

------------------------------------------------------------------------------
-- 6. leaderboard unique keys — fixes Daily / Quiz / Mini-games / Club-funds boards never saving
------------------------------------------------------------------------------
-- Those boards call .upsert(..., { onConflict: 'user_id,mode,difficulty,mode_variant' }).
-- The only matching index was PARTIAL (where user_id is not null), which Postgres cannot infer
-- from a bare ON CONFLICT column list, so every upsert errored (silently — the client ignores
-- the error). As of 2026-10-21 the table contains zero rows for any of those modes.
-- The old (user_id, mode, difficulty) index also prevents one user holding both a Current and
-- an Era Super League row.
update public.leaderboard set mode_variant = 'current' where mode_variant is null;
alter table public.leaderboard alter column mode_variant set default 'current';
alter table public.leaderboard alter column mode_variant set not null;

drop index if exists public.leaderboard_user_mode_difficulty_unique;
drop index if exists public.leaderboard_user_mode_difficulty_variant_uidx;
create unique index leaderboard_user_mode_difficulty_variant_key
  on public.leaderboard (user_id, mode, difficulty, mode_variant);  -- NULL user_ids stay distinct

-- Trophy-cabinet sync deletes zero-trophy rows; without a DELETE policy RLS silently deletes nothing.
create policy "leaderboard_delete_own"
  on public.leaderboard for delete
  to authenticated
  using ((select auth.uid()) = user_id);

------------------------------------------------------------------------------
-- 7. Server-side coach name validation (client-only check could be bypassed)
------------------------------------------------------------------------------
-- NOT VALID: existing rows are not re-checked, new writes are.
alter table public.profiles
  add constraint profiles_coach_name_format
  check (coach_name ~ '^[A-Za-z0-9_]{3,16}$') not valid;  -- mirrors validateCoachName in src/lib/storage/user.ts

-- Signup must not fail with "Database error saving new user" when the requested coach name is
-- already taken (unique index on lower(coach_name)). Skip the insert; the client creates the
-- profile after signup and already handles the name-taken case.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    insert into public.profiles (id, coach_name)
    values (new.id, coalesce(new.raw_user_meta_data->>'coach_name', 'Coach'))
    on conflict (id) do nothing;
  exception when unique_violation or check_violation then
    null;
  end;
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

commit;
