# Moderation (App Store Guideline 1.2)

Coach names are the only user-generated content in 27-0. They show on every leaderboard (Classic,
Trophies, Daily, Weekly, Manager Mode, Puzzles). Titles and frames come from fixed lists.

| Apple asks for | How 27-0 does it |
|---|---|
| Filter objectionable material | `src/lib/moderation/name-filter.ts` (word lists in `blocked-terms.ts`) rejects a name at sign-up with a friendly message. The database refuses the same words on `profiles` and masks them on `leaderboard` / `weekly_challenge_entries`. Any name that fails the filter is shown as "Coach #1234". |
| Report offensive content | ⋯ on any other coach's leaderboard row → Report (offensive name / cheating / something else). Stored in `content_reports`. Guests are asked to log in. |
| Timely response | A name reported by **3 different players** (open, non-cheating reports) is hidden from every board straight away, until reviewed. The owner reviews reports within 24 hours (below). |
| Block abusive users | ⋯ → Hide this coach. Hidden on all of that player's boards, synced with their account (`user_stats` GLOBAL / `hidden_coaches`). Settings → Hidden coaches to undo. |
| Published contact | `CONTACT_EMAIL` in `src/lib/contact.ts` (twentysevenzero@yahoo.com): Settings → Help & feedback → Report a player or content, the Privacy policy, the report sheet. |

## Setup

Apply `supabase/migrations/20261026120000_moderation.sql` once (SQL editor or `apply_migration`).
It's safe on live data: existing rows aren't re-checked. Names are checked only on insert or when the
name changes, and leaderboard names that fail are masked, never rejected.

The word lists exist twice: `src/lib/moderation/blocked-terms.ts` and the arrays inside
`public.coach_name_is_allowed()` in that migration. `npm run test:moderation` fails if they differ.
To change the list: edit `blocked-terms.ts`, run the test (it also checks every player and club name
still passes), then copy the arrays into a new migration that runs `create or replace function
public.coach_name_is_allowed` again.

## Reviewing reports (SQL editor, as the owner)

Open reports, most-reported first:

```sql
select r.reported_user_id,
       p.coach_name                       as current_name,
       p.name_hidden,
       count(distinct r.reporter_id)      as reporters,
       array_agg(distinct r.reason)       as reasons,
       array_agg(distinct r.board)        as boards,
       min(r.created_at)                  as first_report,
       max(r.created_at)                  as last_report
  from public.content_reports r
  left join public.profiles p on p.id = r.reported_user_id
 where r.reviewed_at is null
 group by r.reported_user_id, p.coach_name, p.name_hidden
 order by reporters desc, last_report desc;
```

Every report for one coach:

```sql
select created_at, reason, board, coach_name, profile_coach_name, reporter_id
  from public.content_reports
 where reported_user_id = '<uuid>'
 order by created_at desc;
```

### The name is offensive

Hide it everywhere now (also what auto-hide does):

```sql
select public.moderation_mask_coach('<uuid>');
```

Then either leave it hidden, or rename the coach (the database refuses a blocked name, so pick a
neutral one):

```sql
update public.profiles set coach_name = 'Coach_1234' where id = '<uuid>';
```

Close the reports:

```sql
update public.content_reports
   set reviewed_at = now(), review_note = 'name hidden'
 where reported_user_id = '<uuid>' and reviewed_at is null;
```

For abuse, delete the account in Supabase → Authentication → Users (rows cascade).

### The name is fine (or the reports were cheating claims you've checked)

Close the reports and un-hide the name:

```sql
update public.content_reports
   set reviewed_at = now(), review_note = 'no action'
 where reported_user_id = '<uuid>' and reviewed_at is null;

update public.profiles set name_hidden = false, name_hidden_at = null where id = '<uuid>';

-- Put the real name back on their leaderboard rows (otherwise it comes back on their next score).
update public.leaderboard l
   set coach_name = p.coach_name, player_name = p.coach_name
  from public.profiles p
 where p.id = l.user_id and l.user_id = '<uuid>';

-- Weekly rows are frozen by their guard trigger; switch it off for this one fix.
alter table public.weekly_challenge_entries disable trigger weekly_challenge_entries_guard;
update public.weekly_challenge_entries w
   set coach_name = p.coach_name
  from public.profiles p
 where p.id = w.user_id and w.user_id = '<uuid>';
alter table public.weekly_challenge_entries enable trigger weekly_challenge_entries_guard;
```

Only reports with `reviewed_at is null` count towards auto-hide, so after a review it takes three
new reporters to hide the name again.

### Cheating

Cheating reports never auto-hide anything. Check the coach's rows (`leaderboard`,
`weekly_challenge_entries`) and delete impossible ones, then close the reports as above.

## Limits

- One report per reporter per coach per UTC day; 20 reports per reporter per day.
- Players can insert reports but never read them (no select policy).
- Players can't change `profiles.name_hidden` themselves (trigger keeps the old value).
