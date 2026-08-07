import type { MatchEventType } from "../game/match-events";

export interface MatchEventContext {
  team: string;
  opponent: string;
  player?: string;
  kicker?: string;
  minute: number;
  area?: string;
  score?: string;
  position?: string;
}

export interface MatchStoryMemory {
  usedTemplateIds: Record<string, number>;
  recentEventTypes: MatchEventType[];
  recentPlayers: string[];
  recentPhrases: string[];
  /** Last template id chosen — used to avoid identical consecutive picks. */
  lastTemplateId?: string;
}

type TemplateEntry = { id: string; text: string };

function tpl(id: string, text: string): TemplateEntry {
  return { id, text };
}

export const MATCH_EVENT_TEMPLATES: Partial<Record<MatchEventType, TemplateEntry[]>> = {
  six_again: [
    tpl("six_again_0", "{team} earn a six-again and keep the defence pinned back."),
    tpl("six_again_1", "{team} get a fresh set after sharp ruck speed."),
    tpl("six_again_2", "{team} force repeat pressure with another tackle count."),
    tpl("six_again_3", "{team} keep the ball alive and win another set."),
    tpl("six_again_4", "{team} get six more after {opponent} slow the play-the-ball."),
    tpl("six_again_5", "{team} stay on the attack with a repeat set near the line."),
  ],
  pressure_set: [
    tpl("pressure_0", "{team} build a dangerous set in the {area}."),
    tpl("pressure_1", "{team} win a penalty and tap it quickly."),
    tpl("pressure_2", "{team} camp deep in {opponent} territory."),
    tpl("pressure_3", "{team} force {opponent} to defend back-to-back sets."),
    tpl("pressure_4", "{team} pin {opponent} on their own goal line."),
    tpl("pressure_5", "{team} keep field position with a strong kicking game."),
  ],
  line_break: [
    tpl("line_0", "{player} slices through the line for {team}."),
    tpl("line_1", "{player} hits a gap and puts {team} on the front foot."),
    tpl("line_2", "{team} open the defence through {player}."),
    tpl("line_3", "{player} breaks clear and the crowd lifts."),
    tpl("line_4", "{team} find space as {player} punches through the middle."),
    tpl("line_5", "{player} steps the full-back and races into space."),
    tpl("line_6", "{player} cuts back inside and splits the markers."),
  ],
  big_break: [
    tpl("big_0", "{player} sparks a break from deep and {team} are rolling."),
    tpl("big_1", "{team} carve through the middle with a huge bust from {player}."),
    tpl("big_2", "{player} finds open pasture and {team} are on the charge."),
    tpl("big_3", "A sweeping move ends with {player} tearing into space."),
  ],
  try: [
    tpl("try_0", "{player} crashes over for a try — {team}."),
    tpl("try_1", "{player} finishes the move; try {team}."),
    tpl("try_2", "{team} turn pressure into points — {player} dots down."),
    tpl("try_3", "{player} gets over after a strong attacking set."),
    tpl("try_4", "{player} touches down as {team} stretch the edge."),
    tpl("try_5", "{player} dots down beside the posts for {team}."),
    tpl("try_6", "{player} finishes in the corner after a sweeping move."),
    tpl("try_7", "{team} score from close range through {player}."),
    tpl("try_8", "Try! {player} grounds it for {team}."),
    tpl("try_9", "{player} reaches out and plants it — try {team}."),
  ],
  conversion: [
    tpl("conv_0", "{kicker} adds the extras from in front."),
    tpl("conv_1", "{kicker} converts from out wide — no trouble."),
    tpl("conv_2", "{kicker} nails the conversion{score_clause}."),
    tpl("conv_3", "The conversion is good from {kicker}."),
    tpl("conv_4", "{kicker} steadies himself and slots it over."),
    tpl("conv_5", "{kicker} bisects the posts from the touchline."),
  ],
  goal: [
    tpl("goal_0", "{kicker} adds the extras from in front."),
    tpl("goal_1", "{kicker} converts from out wide — no trouble."),
    tpl("goal_2", "{kicker} nails the kick{score_clause}."),
    tpl("goal_3", "The conversion is good from {kicker}."),
    tpl("goal_4", "{kicker} steadies himself and slots it over."),
  ],
  missed_conversion: [
    tpl("miss_conv_0", "{kicker} misses the conversion wide."),
    tpl("miss_conv_1", "The kick drifts wide off the boot of {kicker}."),
    tpl("miss_conv_2", "{kicker} pushes the conversion across the face."),
    tpl("miss_conv_3", "The extras go begging as {kicker} misses."),
  ],
  penalty_goal: [
    tpl("pg_0", "{team} take the two points from in front."),
    tpl("pg_1", "{kicker} slots the penalty goal for {team}."),
    tpl("pg_2", "{team} slow it down and take the two."),
    tpl("pg_3", "{kicker} kicks the penalty and {team} edge ahead."),
    tpl("pg_4", "{team} opt for goal and {kicker} delivers."),
    tpl("pg_5", "Penalty goal — {kicker} makes no mistake."),
  ],
  penalty: [
    tpl("pen_0", "{team} take the two points from in front."),
    tpl("pen_1", "{kicker} slots the penalty goal for {team}."),
    tpl("pen_2", "{team} slow it down and take the two."),
    tpl("pen_3", "{kicker} kicks the penalty and {team} edge ahead."),
  ],
  drop_goal: [
    tpl("dg_0", "{kicker} nails a drop-goal in the closing stages."),
    tpl("dg_1", "{team} work into range and {kicker} lands a one-pointer."),
    tpl("dg_2", "{kicker} steadies under pressure and slots a drop-goal."),
    tpl("dg_3", "A clutch drop-goal from {kicker} gives {team} the lead."),
    tpl("dg_4", "{kicker} drops over for one — {team}."),
  ],
  missed_drop_goal: [
    tpl("miss_dg_0", "{kicker} misses the drop-goal attempt."),
    tpl("miss_dg_1", "The one-pointer drifts wide — {kicker} can't land it."),
    tpl("miss_dg_2", "{kicker} rushes the drop and misses badly."),
    tpl("miss_dg_3", "{opponent} breathe again as the drop-goal goes wide."),
  ],
  knock_on: [
    tpl("ko_0", "{team} knock on coming out of yardage."),
    tpl("ko_1", "{team} spill the ball under heavy contact."),
    tpl("ko_2", "{team} lose possession on the last tackle."),
    tpl("ko_3", "A costly knock-on from {team} in the {area}."),
    tpl("ko_4", "{team} are punished for a loose carry."),
  ],
  forward_pass: [
    tpl("fp_0", "{team} are pinged for a forward pass."),
    tpl("fp_1", "The referee rules a forward pass against {team}."),
    tpl("fp_2", "{team} throw a suspect pass and lose possession."),
  ],
  forced_error: [
    tpl("fe_0", "{opponent} force {team} into an error near their line."),
    tpl("fe_1", "Relentless defence from {opponent} forces a mistake."),
    tpl("fe_2", "{team} crack under marker pressure."),
    tpl("fe_3", "{opponent} win possession with a forced error."),
  ],
  try_saver: [
    tpl("ts_0", "{player} makes a try-saving tackle on the line."),
    tpl("ts_1", "Scramble defence from {team} as {player} hauls him down."),
    tpl("ts_2", "{player} drags the attacker down inches short."),
    tpl("ts_3", "{team} hold firm — {player} with a last-ditch stop."),
    tpl("ts_4", "Brilliant cover from {player} to prevent the try."),
  ],
  held_up: [
    tpl("hu_0", "{team} are held up over the line."),
    tpl("hu_1", "Desperate defence stops {team} short of a try."),
    tpl("hu_2", "{player} is held up — goal-line dropout coming."),
  ],
  goal_line_dropout: [
    tpl("gld_0", "{team} force a goal-line dropout with scrambling defence."),
    tpl("gld_1", "Held up — {opponent} will restart from a dropout."),
    tpl("gld_2", "{team} survive a goal-line raid."),
  ],
  momentum_shift: [
    tpl("mom_0", "Momentum swings back to {team}."),
    tpl("mom_1", "{team} win the battle for field position."),
    tpl("mom_2", "{team} claw back control in the middle third."),
    tpl("mom_3", "The tide turns as {team} find some rhythm."),
    tpl("mom_4", "{team} lift the intensity and shift the contest."),
  ],
  last_tackle_kick: [
    tpl("ltk_0", "{team} kick on the last and force a repeat set."),
    tpl("ltk_1", "A clever last-tackle kick from {team} pins {opponent} deep."),
    tpl("ltk_2", "{team} find touch on the final tackle."),
  ],
  forty_twenty: [
    tpl("4020_0", "{team} land a forty-twenty — repeat set on the line."),
    tpl("4020_1", "A huge forty-twenty gives {team} a golden chance."),
    tpl("4020_2", "{kicker} pins {opponent} in-goal with a perfect kick."),
  ],
  sin_bin: [
    tpl("sb_0", "{player} is sent to the sin bin for ten minutes."),
    tpl("sb_1", "{team} go down to twelve — {player} in the bin."),
    tpl("sb_2", "The referee shows yellow to {player}."),
  ],
  injury: [
    tpl("inj_0", "{player} is down and needs treatment."),
    tpl("inj_1", "A stoppage as {player} receives attention."),
    tpl("inj_2", "{team} lose {player} temporarily after a heavy hit."),
    tpl("inj_3", "Concern for {player} — the trainers are on."),
  ],
  interchange: [
    tpl("int_0", "{team} make an interchange."),
    tpl("int_1", "Fresh legs on for {team}."),
    tpl("int_2", "{team} rotate from the bench."),
    tpl("int_3", "An interchange refresh for {team}."),
  ],
  half_time: [
    tpl("ht_0", "Half-time{score_clause}."),
    tpl("ht_1", "The teams head to the sheds at the break{score_clause}."),
    tpl("ht_2", "Half-time whistle{score_clause}."),
  ],
  full_time: [
    tpl("ft_0", "Full time{score_clause}."),
    tpl("ft_1", "The hooter sounds — that's the game{score_clause}."),
    tpl("ft_2", "Full time whistle{score_clause}."),
  ],
  note: [
    tpl("note_0", "{team} dominate possession in the {area}."),
    tpl("note_1", "{team} are camped in {opponent} territory."),
    tpl("note_2", "{team} win the ruck-speed battle."),
    tpl("note_3", "A tense spell as {team} probe the defence."),
  ],
};

const DEFAULT_AREA = "middle third";

const GENERIC_PLAYER = "a player";
const GENERIC_KICKER = "the kicker";

function safeName(
  value: string | undefined,
  fallback: string,
  banned: string[] = []
): string {
  const trimmed = value?.trim();
  if (!trimmed) return fallback;
  const lower = trimmed.toLowerCase();
  if (lower === "undefined" || lower === "null" || lower === "unknown") {
    return fallback;
  }
  if (banned.some((b) => b && trimmed.toLowerCase() === b.toLowerCase())) {
    return fallback;
  }
  return trimmed;
}

function scoreClause(score: string | undefined): string {
  const s = score?.trim();
  if (!s || s === "-" || /^0-0$/i.test(s)) return "";
  return ` — ${s}`;
}

function tidyPhrase(text: string): string {
  return text
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,!?])/g, "$1")
    .replace(/\s*[—-]\s*\./g, ".")
    .replace(/\.\s*\./g, ".")
    .trim();
}

function fillTemplate(text: string, ctx: MatchEventContext): string {
  const banned = [ctx.team, ctx.opponent].filter(Boolean);
  const player = safeName(ctx.player, GENERIC_PLAYER, banned);
  const kicker = safeName(ctx.kicker, GENERIC_KICKER, banned);
  const clause = scoreClause(ctx.score);
  const filled = text
    .replaceAll("{team}", ctx.team || "the home side")
    .replaceAll("{opponent}", ctx.opponent || "the opposition")
    .replaceAll("{player}", player)
    .replaceAll("{kicker}", kicker)
    .replaceAll("{minute}", String(ctx.minute))
    .replaceAll("{area}", ctx.area?.trim() || DEFAULT_AREA)
    .replaceAll("{score_clause}", clause)
    .replaceAll("{score}", ctx.score?.trim() || "")
    .replaceAll("{position}", ctx.position?.trim() || "");
  return tidyPhrase(filled);
}

export function createMatchStoryMemory(): MatchStoryMemory {
  return {
    usedTemplateIds: {},
    recentEventTypes: [],
    recentPlayers: [],
    recentPhrases: [],
  };
}

export function memoryFromEvents(
  events: Array<{
    type: MatchEventType | string;
    description: string;
    playerName?: string;
  }>
): MatchStoryMemory {
  const memory = createMatchStoryMemory();
  for (const ev of events) {
    const type = ev.type as MatchEventType;
    memory.recentEventTypes.push(type);
    if (ev.playerName) memory.recentPlayers.push(ev.playerName);
    memory.recentPhrases.push(ev.description.replace(/^\d+'\s*/, ""));
  }
  if (memory.recentEventTypes.length > 8) {
    memory.recentEventTypes = memory.recentEventTypes.slice(-8);
  }
  if (memory.recentPlayers.length > 6) {
    memory.recentPlayers = memory.recentPlayers.slice(-6);
  }
  if (memory.recentPhrases.length > 10) {
    memory.recentPhrases = memory.recentPhrases.slice(-10);
  }
  return memory;
}

function isRecentPhrase(phrase: string, memory: MatchStoryMemory): boolean {
  const lower = phrase.toLowerCase();
  return memory.recentPhrases.some((p) => p.toLowerCase() === lower);
}

function isIdenticalToLast(phrase: string, memory: MatchStoryMemory): boolean {
  const last = memory.recentPhrases[memory.recentPhrases.length - 1];
  return Boolean(last && last.toLowerCase() === phrase.toLowerCase());
}

function sameTypeStreak(type: MatchEventType, memory: MatchStoryMemory): number {
  let streak = 0;
  for (let i = memory.recentEventTypes.length - 1; i >= 0; i--) {
    if (memory.recentEventTypes[i] === type) streak++;
    else break;
  }
  return streak;
}

export function recordTemplateUse(
  memory: MatchStoryMemory,
  templateId: string,
  phrase: string,
  eventType: MatchEventType,
  player?: string
): void {
  memory.usedTemplateIds[templateId] =
    (memory.usedTemplateIds[templateId] ?? 0) + 1;
  memory.lastTemplateId = templateId;
  memory.recentPhrases.push(phrase);
  if (memory.recentPhrases.length > 10) {
    memory.recentPhrases = memory.recentPhrases.slice(-10);
  }
  memory.recentEventTypes.push(eventType);
  if (memory.recentEventTypes.length > 8) {
    memory.recentEventTypes = memory.recentEventTypes.slice(-8);
  }
  if (player) {
    memory.recentPlayers.push(player);
    if (memory.recentPlayers.length > 6) {
      memory.recentPlayers = memory.recentPlayers.slice(-6);
    }
  }
}

export function pickEventTemplate(
  eventType: MatchEventType,
  context: MatchEventContext,
  memory: MatchStoryMemory,
  rng: () => number
): { text: string; templateId: string } {
  const pool = MATCH_EVENT_TEMPLATES[eventType] ?? MATCH_EVENT_TEMPLATES.note ?? [];
  if (pool.length === 0) {
    const fallback = `${context.team || "A side"} make their mark.`;
    return { text: fallback, templateId: `${eventType}_fallback` };
  }

  const typeStreak = sameTypeStreak(eventType, memory);
  const maxSameTypeStreak = eventType === "try" ? 2 : 3;

  const banned = [context.team, context.opponent].filter(Boolean);
  const hasPlayer = Boolean(safeName(context.player, "", banned));
  const hasKicker = Boolean(safeName(context.kicker, "", banned));

  let candidates = pool.filter((entry) => {
    if (memory.lastTemplateId && entry.id === memory.lastTemplateId) {
      return false;
    }
    // Prefer team-only lines when we lack a named player/kicker — avoids
    // "a player" / "the kicker" commentary with no real identity.
    if (!hasPlayer && entry.text.includes("{player}")) return false;
    if (!hasKicker && entry.text.includes("{kicker}")) return false;
    const phrase = fillTemplate(entry.text, context);
    if (isIdenticalToLast(phrase, memory)) return false;
    if (isRecentPhrase(phrase, memory)) return false;
    if (
      context.player &&
      memory.recentPlayers.slice(-2).includes(context.player) &&
      entry.text.includes("{player}") &&
      typeStreak >= 1
    ) {
      return false;
    }
    return true;
  });

  if (candidates.length === 0) {
    candidates = pool.filter((entry) => {
      if (memory.lastTemplateId && entry.id === memory.lastTemplateId) {
        return false;
      }
      if (!hasPlayer && entry.text.includes("{player}")) return false;
      if (!hasKicker && entry.text.includes("{kicker}")) return false;
      const phrase = fillTemplate(entry.text, context);
      return !isIdenticalToLast(phrase, memory);
    });
  }

  if (candidates.length === 0) {
    // Last resort: allow player/kicker templates only when we have names;
    // otherwise keep team-only lines so we never emit "a player".
    candidates = pool.filter((entry) => {
      if (!hasPlayer && entry.text.includes("{player}")) return false;
      if (!hasKicker && entry.text.includes("{kicker}")) return false;
      return true;
    });
  }

  if (candidates.length === 0) {
    candidates = [...pool].sort(
      (a, b) =>
        (memory.usedTemplateIds[a.id] ?? 0) - (memory.usedTemplateIds[b.id] ?? 0)
    );
  }

  candidates.sort(
    (a, b) =>
      (memory.usedTemplateIds[a.id] ?? 0) - (memory.usedTemplateIds[b.id] ?? 0)
  );

  if (typeStreak >= maxSameTypeStreak && candidates.length > 1) {
    // Prefer least-used when the same event type is streaking.
    candidates = candidates.slice(0, Math.max(2, Math.ceil(candidates.length / 2)));
  }

  const leastUsed = memory.usedTemplateIds[candidates[0].id] ?? 0;
  const tier = candidates.filter(
    (c) => (memory.usedTemplateIds[c.id] ?? 0) <= leastUsed + 1
  );
  const chosen = tier[Math.floor(rng() * tier.length)] ?? candidates[0];
  const text = fillTemplate(chosen.text, context);
  return { text, templateId: chosen.id };
}

function lineFromPool(
  eventType: MatchEventType,
  context: MatchEventContext,
  memory: MatchStoryMemory,
  rng: () => number
): string {
  const { text, templateId } = pickEventTemplate(
    eventType,
    context,
    memory,
    rng
  );
  recordTemplateUse(memory, templateId, text, eventType, context.player);
  return text;
}

function withMemory(
  memory: MatchStoryMemory | undefined
): MatchStoryMemory {
  return memory ?? createMatchStoryMemory();
}

/** Concise UK English try line. */
export function formatTryEvent(
  context: MatchEventContext,
  memory?: MatchStoryMemory,
  rng: () => number = Math.random
): string {
  return lineFromPool("try", context, withMemory(memory), rng);
}

/** Conversion / goal extras. */
export function formatConversionEvent(
  context: MatchEventContext,
  memory?: MatchStoryMemory,
  rng: () => number = Math.random
): string {
  return lineFromPool("conversion", context, withMemory(memory), rng);
}

/** Penalty goal (two points). */
export function formatPenaltyGoalEvent(
  context: MatchEventContext,
  memory?: MatchStoryMemory,
  rng: () => number = Math.random
): string {
  return lineFromPool("penalty_goal", context, withMemory(memory), rng);
}

/** Field drop-goal (one point). */
export function formatDropGoalEvent(
  context: MatchEventContext,
  memory?: MatchStoryMemory,
  rng: () => number = Math.random
): string {
  return lineFromPool("drop_goal", context, withMemory(memory), rng);
}

/** Interchange / substitution refresh. */
export function formatSubstitutionEvent(
  context: MatchEventContext,
  memory?: MatchStoryMemory,
  rng: () => number = Math.random
): string {
  return lineFromPool("interchange", context, withMemory(memory), rng);
}

/** Injury stoppage. */
export function formatInjuryEvent(
  context: MatchEventContext,
  memory?: MatchStoryMemory,
  rng: () => number = Math.random
): string {
  return lineFromPool("injury", context, withMemory(memory), rng);
}

/** Half-time whistle. */
export function formatHalfTimeEvent(
  context: MatchEventContext,
  memory?: MatchStoryMemory,
  rng: () => number = Math.random
): string {
  return lineFromPool("half_time", context, withMemory(memory), rng);
}

/** Full-time hooter. */
export function formatFullTimeEvent(
  context: MatchEventContext,
  memory?: MatchStoryMemory,
  rng: () => number = Math.random
): string {
  return lineFromPool("full_time", context, withMemory(memory), rng);
}

/**
 * Explicit Golden Point start — always names the period.
 * Prefer this over generic note templates when extra time begins.
 */
export function formatGoldenPointStartEvent(
  context?: Partial<MatchEventContext>
): string {
  const score = context?.score?.trim();
  if (score && score !== "-" && !/^0-0$/i.test(score)) {
    return `Scores are level at ${score} — Golden Point begins.`;
  }
  return "Scores are level — Golden Point begins.";
}

export function buildCommentaryLine(
  eventType: MatchEventType,
  context: MatchEventContext,
  memory: MatchStoryMemory,
  rng: () => number
): string {
  switch (eventType) {
    case "try":
      return formatTryEvent(context, memory, rng);
    case "conversion":
    case "goal":
      return formatConversionEvent(context, memory, rng);
    case "penalty_goal":
    case "penalty":
      return formatPenaltyGoalEvent(context, memory, rng);
    case "drop_goal":
      return formatDropGoalEvent(context, memory, rng);
    case "interchange":
      return formatSubstitutionEvent(context, memory, rng);
    case "injury":
      return formatInjuryEvent(context, memory, rng);
    case "half_time":
      return formatHalfTimeEvent(context, memory, rng);
    case "full_time":
      return formatFullTimeEvent(context, memory, rng);
    default:
      return lineFromPool(eventType, context, memory, rng);
  }
}

export function territoryForMinute(minute: number): string {
  if (minute >= 70) return "opposition 20";
  if (minute >= 45) return "middle third";
  if (minute <= 15) return "own half";
  return "middle third";
}
