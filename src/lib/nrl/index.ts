/** NRL data scaffold — World Club Challenge today, full teams later. */
export {
  generateNrlSquadNames,
  getAllNrlClubsAsClub,
  getNrlClubById,
  getNrlClubByName,
  isNrlClubName,
  NRL_CLUBS,
  NRL_WORLD_CLUB_CHALLENGE_TEAMS,
  nrlClubToClub,
  nrlStrengthTierToBaseRating,
  rollNrlChampionRatingForClub,
  type NrlClubRecord,
  type NrlGeneratedPlayer,
} from "./nrlClubs";

export {
  DEFAULT_NRL_NAME_BIAS,
  NRL_FIRST_NAMES,
  NRL_LAST_NAMES,
  type NrlNamePool,
} from "./nrlNamePools";
