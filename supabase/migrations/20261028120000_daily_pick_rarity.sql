-- 2026-10-28 — Daily pick rarity ("12% picked him") (v1.19)
-- NOT YET APPLIED. Safe to apply before or after the v1.19 client: the client treats a missing
-- RPC as "no rarity" and simply hides the feature.
--
-- No DROP / DELETE / TRUNCATE: everything is `create ... if not exists` / `create or replace`,
-- and grants are idempotent.
--
-- What this does
--   1. daily_pick_rarity_picks: one row per signed-in coach per Daily slot per UK day
--      (primary key day_key + user_id + slot). No client access to the table.
--   2. record_daily_picks(day, run id, picks jsonb): insert-only. Signed-in callers only; the row
--      is always the caller's (auth.uid()). Today or yesterday (UK) only, slots 0-12, at most 13
--      picks, card ids [A-Za-z0-9._-]{1,80}. `on conflict do nothing`, so the first counted run of
--      the day wins and re-calls are no-ops: rate-limited by construction to 13 rows per coach
--      per day. Returns how many rows were new.
--   3. get_daily_pick_rarity(day, picks jsonb): for each (slot, card) the caller passes, how many
--      coaches picked that card in that slot and how many picked anything in that slot. Aggregate
--      counts only, never user ids. The caller must name the cards, so the RPC can't be used to
--      list today's spins before playing the Daily. Not for future days.
--
-- Guests: picks are not recorded (no identity to rate-limit on); guests can still read rarity
-- for their own picks.

begin;

create table if not exists public.daily_pick_rarity_picks (
  day_key date not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  slot smallint not null check (slot between 0 and 12),
  card_id text not null check (card_id ~ '^[A-Za-z0-9._-]{1,80}$'),
  run_id text not null check (char_length(run_id) between 1 and 120),
  created_at timestamptz not null default now(),
  primary key (day_key, user_id, slot)
);

create index if not exists daily_pick_rarity_picks_card_idx
  on public.daily_pick_rarity_picks (day_key, slot, card_id);

alter table public.daily_pick_rarity_picks enable row level security;
revoke all on table public.daily_pick_rarity_picks from anon, authenticated;

create or replace function public.record_daily_picks(
  p_day_key date,
  p_run_id text,
  p_picks jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_today date := (now() at time zone 'Europe/London')::date;
  v_pick jsonb;
  v_slot integer;
  v_card text;
  v_inserted integer := 0;
  v_rows integer;
begin
  if v_user is null then
    raise exception 'record_daily_picks: sign in required' using errcode = '42501';
  end if;
  if p_day_key is null or p_day_key not in (v_today, v_today - 1) then
    raise exception 'record_daily_picks: day closed' using errcode = 'check_violation';
  end if;
  if p_run_id is null or char_length(p_run_id) not between 1 and 120 then
    raise exception 'record_daily_picks: bad run id' using errcode = 'check_violation';
  end if;
  if p_picks is null or jsonb_typeof(p_picks) <> 'array' or jsonb_array_length(p_picks) > 13 then
    raise exception 'record_daily_picks: bad picks' using errcode = 'check_violation';
  end if;

  for v_pick in select value from jsonb_array_elements(p_picks)
  loop
    if jsonb_typeof(v_pick) <> 'object'
      or jsonb_typeof(v_pick -> 'slot') <> 'number'
      or jsonb_typeof(v_pick -> 'card_id') <> 'string' then
      raise exception 'record_daily_picks: bad pick' using errcode = 'check_violation';
    end if;
    v_slot := (v_pick ->> 'slot')::integer;
    v_card := v_pick ->> 'card_id';
    if v_slot not between 0 and 12 or v_card !~ '^[A-Za-z0-9._-]{1,80}$' then
      raise exception 'record_daily_picks: bad pick' using errcode = 'check_violation';
    end if;
    insert into public.daily_pick_rarity_picks (day_key, user_id, slot, card_id, run_id)
    values (p_day_key, v_user, v_slot, v_card, p_run_id)
    on conflict (day_key, user_id, slot) do nothing;
    get diagnostics v_rows = row_count;
    v_inserted := v_inserted + v_rows;
  end loop;

  return v_inserted;
end;
$$;

revoke execute on function public.record_daily_picks(date, text, jsonb) from public, anon;
grant execute on function public.record_daily_picks(date, text, jsonb) to authenticated;

create or replace function public.get_daily_pick_rarity(
  p_day_key date,
  p_picks jsonb
)
returns table (slot integer, card_id text, picked bigint, slot_total bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with wanted as (
    select distinct
      (e.value ->> 'slot')::integer as slot,
      e.value ->> 'card_id' as card_id
    from jsonb_array_elements(
      case when jsonb_typeof(p_picks) = 'array' then p_picks else '[]'::jsonb end
    ) with ordinality as e(value, ord)
    where e.ord <= 13
      and jsonb_typeof(e.value) = 'object'
      and jsonb_typeof(e.value -> 'slot') = 'number'
      and (e.value ->> 'slot') ~ '^(1[0-2]|[0-9])$'
      and (e.value ->> 'card_id') ~ '^[A-Za-z0-9._-]{1,80}$'
  )
  select
    w.slot,
    w.card_id,
    (select count(*) from public.daily_pick_rarity_picks p
      where p.day_key = p_day_key and p.slot = w.slot and p.card_id = w.card_id) as picked,
    (select count(*) from public.daily_pick_rarity_picks p
      where p.day_key = p_day_key and p.slot = w.slot) as slot_total
  from wanted w
  where p_day_key is not null
    and p_day_key <= (now() at time zone 'Europe/London')::date
  order by w.slot;
$$;

revoke execute on function public.get_daily_pick_rarity(date, jsonb) from public;
grant execute on function public.get_daily_pick_rarity(date, jsonb) to anon, authenticated;

commit;
