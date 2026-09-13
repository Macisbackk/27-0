/**
 * Hidden IRL-informed goal-kicking ratings (1–99) for Current-era players.
 * Used by Manager Mode for kicker selection / recommendation only —
 * not shown as a visible card attribute in Quick Mode.
 *
 * Calibrated to 2026 Super League / Championship kicking usage where known
 * (volume leaders + acknowledged specialists), then filled for every Current
 * halfback so club recommendation is never a pure RNG roll.
 *
 * Scale: 95+ elite specialists · 85–94 primary club kickers ·
 * 75–84 reliable deputies · 65–74 occasional · below 60 rarely tee-kick.
 */
export const PLAYER_GOAL_KICKING_OVERRIDES: Record<string, number> = {
  // ─── Warrington Wolves ───────────────────────────────────────────────
  "warrington-cur-marc-sneyd": 96, // elite specialist (accuracy)
  "warrington-cur-ewan-irwin": 84, // 2026 volume deputy / share
  "warrington-cur-george-williams": 78,
  "warrington-cur-leon-hayes": 64,

  // ─── Wigan Warriors ──────────────────────────────────────────────────
  "wigan-cur-adam-keighran": 95, // primary 2026 tee (centre/utility)
  "wigan-cur-harry-smith": 92, // primary half + drop-goal threat
  "wigan-cur-bevan-french": 72,
  "wigan-cur-jack-farrimond": 68,
  "wigan-cur-jai-field": 62,

  // ─── Hull KR ─────────────────────────────────────────────────────────
  "hull-kr-cur-rhyse-martin": 94, // primary 2026 tee (second-row specialist)
  "hull-kr-cur-danny-richardson": 90,
  "hull-kr-cur-mikey-lewis": 82,
  "hull-kr-cur-tyrone-may": 70,
  "hull-kr-cur-jack-charles": 62,

  // ─── Leigh Leopards ──────────────────────────────────────────────────
  "leigh-cur-adam-cook": 90, // primary 2026 volume
  "leigh-cur-gareth-o-brien": 91, // elite accuracy when selected
  "leigh-cur-ben-mcnamara": 84,
  "leigh-cur-lachlan-lam": 74,
  // ─── Leeds Rhinos ────────────────────────────────────────────────────
  "leeds-cur-jake-connor": 93, // 2026 Super League goals leader
  "leeds-cur-brodie-croft": 78,

  // ─── St Helens ───────────────────────────────────────────────────────
  "st-helens-cur-jackson-hastings": 89, // primary 2026 tee
  "st-helens-cur-jonny-lomax": 86,
  "st-helens-cur-george-whitby": 78,
  "st-helens-cur-tristan-sailor": 66,
  "st-helens-cur-jack-welsby": 70,

  // ─── Huddersfield Giants ─────────────────────────────────────────────
  "huddersfield-cur-oliver-russell": 90,
  "huddersfield-cur-tui-lolohea": 80,
  "huddersfield-cur-adam-clune": 70,
  "huddersfield-cur-kieran-rush": 62,

  // ─── Wakefield Trinity ───────────────────────────────────────────────
  "wakefield-cur-mason-lino": 89,
  "wakefield-cur-jack-sinfield": 84,
  "wakefield-cur-jake-trueman": 74,
  "wakefield-cur-myles-lawford": 66,

  // ─── Hull FC ─────────────────────────────────────────────────────────
  "hull-fc-cur-zak-hardaker": 86, // primary 2026 tee (fullback)
  "hull-fc-cur-aidan-sezer": 85,
  "hull-fc-cur-cade-cust": 70,
  "hull-fc-cur-jake-arthur": 58,

  // ─── Catalans Dragons ────────────────────────────────────────────────
  "catalans-cur-toby-sexton": 86,
  "catalans-cur-lewis-dodd": 82,
  "catalans-cur-cesar-rouge": 76,
  "catalans-cur-tommy-makinson": 72,

  // ─── Toulouse Olympique ──────────────────────────────────────────────
  "toulouse-cur-jake-shorrocks": 89, // primary 2026 tee
  "toulouse-cur-thomas-lacans": 68,
  "toulouse-cur-luke-polselli": 58,

  // ─── Castleford Tigers ───────────────────────────────────────────────
  "castleford-cur-tom-weaver": 87, // primary 2026 tee
  "castleford-cur-chris-atkin": 80,
  "castleford-cur-daejarn-asi": 66,
  "castleford-cur-jenson-windley": 60,

  // ─── Bradford Bulls ──────────────────────────────────────────────────
  "bradford-cur-rowan-milnes": 87,
  "bradford-cur-joe-keyes": 85,
  "bradford-cur-jayden-nikorima": 70,
  "bradford-cur-caleb-aekins": 64,

  // ─── York Knights ────────────────────────────────────────────────────
  "york-cur-liam-harris": 86,
  "york-cur-ata-hingano": 74,
  "york-cur-nikau-williams": 72,

  // ─── London Broncos ──────────────────────────────────────────────────
  "london-cur-oliver-leyland": 80,
  "london-cur-jack-campagnolo": 76,
  "london-cur-jimmy-meadows": 64,

  // ─── Sheffield Eagles ────────────────────────────────────────────────
  "sheffield-cur-jordan-lilley": 82,
  "sheffield-cur-kai-morgan": 68,

  // ─── Oldham ──────────────────────────────────────────────────────────
  "oldham-cur-jonty-gorley": 74,

  // ─── Salford Red Devils ──────────────────────────────────────────────
  "salford-cur-logan-ewington": 78,
};
