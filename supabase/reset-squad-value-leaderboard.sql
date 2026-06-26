-- Reset squad value scores on mode leaderboards (keeps wins, perfect runs, etc.).
-- Run in Supabase Dashboard → SQL Editor after deploying the client reset.

update public.leaderboard
set score = 0
where mode in ('super-league', 'draft', 'fantasy');
