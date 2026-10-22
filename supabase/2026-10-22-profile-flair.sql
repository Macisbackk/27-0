-- Store titles shown next to coach names on the leaderboards.
-- Stores only a title id from the Store catalogue (never free text), so nobody can write their own.
alter table public.profiles add column if not exists flair text;
alter table public.profiles drop constraint if exists profiles_flair_valid;
alter table public.profiles add constraint profiles_flair_valid check (
  flair is null or flair in (
    'title-ball-knower', 'title-spin-doctor', 'title-deadline-dealer', 'title-golden-point',
    'title-academy-guru', 'title-gf-gaffer', 'title-invincible', 'title-27-0-legend'
  )
);
