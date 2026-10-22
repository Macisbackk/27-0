-- Lets a signed-in player delete their own account and online data.
-- Required by Google Play and the App Store for apps that let people create accounts.
-- Run once in the Supabase SQL editor (or via the Supabase MCP apply_migration).
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not signed in';
  end if;
  -- leaderboard.user_id has no ON DELETE CASCADE, so clear it first.
  delete from public.leaderboard where user_id = uid;
  -- profiles and user_stats cascade from auth.users.
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
