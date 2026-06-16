-- Public read for lifetime club funds totals + authenticated leaderboard upsert.
-- Run in Supabase SQL editor after auth-schema.sql and leaderboard-schema.sql.

-- Source of truth: user_stats rows written by saveCloudClubFunds (stat_key club_funds).
drop policy if exists "Public read club funds totals" on public.user_stats;
create policy "Public read club funds totals"
  on public.user_stats for select
  using (
    mode = 'GLOBAL'
    and stat_key = 'club_funds'
    and stat_value > 0
  );

-- Ensure logged-in users can upsert their own club-funds leaderboard row.
drop policy if exists "Authenticated update own leaderboard" on public.leaderboard;
create policy "Authenticated update own leaderboard"
  on public.leaderboard for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
