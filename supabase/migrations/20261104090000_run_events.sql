-- Anonymous run analytics (v1.70): one row when a Classic / Era / Daily / Weekly run starts and
-- one when it finishes, so the real 27-0 rate, attempts per 27-0 and the quit rate (starts with
-- no finish) can be measured by game version. No account details: a random id per device.
create table if not exists public.run_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  device_id text not null check (device_id ~ '^[a-z0-9-]{8,64}$'),
  run_id text not null check (char_length(run_id) between 1 and 120),
  event text not null check (event in ('start', 'finish')),
  kind text not null check (kind ~ '^[a-z0-9-]{1,40}$'),
  version text not null check (version ~ '^v[0-9]+\.[0-9]+$'),
  wins smallint check (wins between 0 and 40),
  losses smallint check (losses between 0 and 40),
  perfect boolean,
  unique (device_id, run_id, event)
);

create index if not exists run_events_kind_version_idx on public.run_events (kind, version, event);

alter table public.run_events enable row level security;

-- Anyone (guest or signed in) may add an event; nobody can read, change or delete them via the API.
drop policy if exists run_events_insert on public.run_events;
create policy run_events_insert on public.run_events
  for insert to anon, authenticated
  with check (true);

grant insert on public.run_events to anon, authenticated;
revoke select, update, delete on public.run_events from anon, authenticated;
