import type { ManagerCareer } from "./types";
import { SAVE_STORAGE_VERSION } from "./managerSaveVersion";

const MAX_INBOX = 80;
const MAX_NEWS = 10;
const MAX_LEAGUE_TRANSFERS = 32;
/** Keep live event timelines only for the most recent fixtures. */
const LIVE_EVENT_FIXTURE_KEEP = 2;

/**
 * Strip UI-temporary / oversized feed data before durable persistence.
 * Hydrate rebuilds defaults; Match Review keeps lastMatchFixture events.
 */
export function compactCareerForPersistence(
  career: ManagerCareer
): ManagerCareer {
  const lastId = career.lastMatchFixture?.fixtureId;
  const fixtures = (career.fixtures ?? []).map((fixture, index, arr) => {
    const keepEvents =
      fixture.fixtureId === lastId ||
      index >= arr.length - LIVE_EVENT_FIXTURE_KEEP;
    if (keepEvents || !fixture.meta?.liveEvents?.length) return fixture;
    const { liveEvents: _drop, ...metaRest } = fixture.meta;
    return { ...fixture, meta: metaRest };
  });

  const inbox = [...(career.inboxMessages ?? [])];
  inbox.sort((a, b) => {
    const aKeep = !a.read || !a.resolved ? 1 : 0;
    const bKeep = !b.read || !b.resolved ? 1 : 0;
    if (aKeep !== bKeep) return bKeep - aKeep;
    return (b.week ?? 0) - (a.week ?? 0);
  });

  return {
    ...career,
    saveStorageVersion: SAVE_STORAGE_VERSION,
    hubResultsExpanded: false,
    inboxMessages: inbox.slice(0, MAX_INBOX),
    latestNews: (career.latestNews ?? []).slice(0, MAX_NEWS),
    leagueTransfers: (career.leagueTransfers ?? []).slice(
      0,
      MAX_LEAGUE_TRANSFERS
    ),
    fixtures,
  };
}
