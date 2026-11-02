-- v1.59: allow every Store title / frame id (the fixed lists rejected newer items).
alter table public.profiles drop constraint if exists profiles_flair_valid;
alter table public.profiles drop constraint if exists profiles_frame_valid;
alter table public.profiles add constraint profiles_flair_valid check (flair is null or flair ~ '^title-[a-z0-9-]{1,40}$');
alter table public.profiles add constraint profiles_frame_valid check (frame is null or frame ~ '^frame-[a-z0-9-]{1,40}$');
