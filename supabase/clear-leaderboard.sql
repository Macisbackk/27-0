-- Wipe all online leaderboard rows (safe to re-run).
-- Run in Supabase Dashboard → SQL Editor.
-- Requires project owner / service-role access.

delete from public.leaderboard;

-- Optional: reset cloud draft stats polluted before the draft difficulty fix.
-- Uncomment if Hard Draft stats include Standard Draft runs from the old bug.
-- delete from public.user_stats where mode in ('DRAFT_NORMAL', 'DRAFT_HARD');
