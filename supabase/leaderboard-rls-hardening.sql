-- Run after leaderboard-schema.sql and auth-schema.sql.
-- Removes permissive public write policies on leaderboard.

alter table public.leaderboard add column if not exists perfect_runs integer;
update public.leaderboard set perfect_runs = 0 where perfect_runs is null;

drop policy if exists "Allow public insert leaderboard" on public.leaderboard;
drop policy if exists "Allow public update leaderboard" on public.leaderboard;
