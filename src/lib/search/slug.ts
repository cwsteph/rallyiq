// src/lib/search/slug.ts
//
// Canonical identity for a tournament, across two sources that share no names.
//
// The committed Sackmann CSVs cover 2026-01-01 to 2026-05-17 and use short
// venue names ("Geneva", "Hamburg", "Indian Wells Masters"). The ESPN log
// covers 2026-05-18 onward and uses whatever the sponsor paid for ("Gonet
// Geneva Open", "Terra Wortmann Open", "Cerity Partners Hall of Fame Open for
// the Van Alen Cup Presented by the Margaret Fund"). Exact-name overlap between
// the two sets is zero.
//
// Pure by design — no imports, no node built-ins, no `@/` alias — so both
// scripts/season-index.ts and the app can use it. The alias table lives here
// rather than in data/ for the same reason: a pure function cannot read a file,
// and this is knowledge about tennis, not configuration.

/** Lowercase, strip accents, keep alphanumerics. Mirrors scripts/espn/surface.ts. */
export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

/** Words that identify no tournament on their own. */
const GENERIC = new Set([
  'open', 'opens', 'championships', 'championship', 'international',
  'internationaux', 'internazionali', 'internacional', 'masters', 'trophy',
  'trofeo', 'classic', 'ladies', 'mens', 'womens', 'tennis', 'tour', 'atp',
  'wta', 'presented', 'powered', 'sponsored', 'presents', 'by', 'de', 'di',
  'du', 'del', 'della', 'delle', 'the', 'grand', 'prix',
])

/**
 * Slams keep five-set men's draws and are the names people actually search, so
 * they short-circuit before any stripping — "US Open" would otherwise reduce to
 * the token "us".
 */
const SLAMS: Record<string, string> = {
  australianopen: 'Australian Open',
  rolandgarros: 'Roland Garros',
  frenchopen: 'Roland Garros',
  wimbledon: 'Wimbledon',
  thechampionships: 'Wimbledon',
  thechampionshipswimbledon: 'Wimbledon',
  usopen: 'US Open',
}

/**
 * Sponsor name -> the venue the tour and its audience actually use, keyed on
 * the stripped token string.
 *
 * Four of these are load-bearing rather than cosmetic. Geneva, Hamburg,
 * Strasbourg and Rabat straddle the 2026-05-17 CSV cutoff, so they appear in
 * both sources under different names and would otherwise be indexed twice. The
 * rest are ESPN-only events where the sponsored name is the only name in the
 * data — searching "Halle" or "Queen's" would find nothing without them.
 *
 * Deliberately omitted: Challenger and ITF events whose venue I could not
 * confirm. An unmapped tournament still indexes and still works; it just shows
 * the name ESPN gave it.
 */
const ALIASES: Record<string, string> = {
  // straddle the CSV cutoff — these merges prevent duplicate index entries
  gonetgeneva: 'Geneva',
  bitpandahamburg: 'Hamburg',
  sonaltesseroyalelaprincesselallameryem: 'Rabat',

  // ESPN-only, renamed so the venue is searchable
  hsbc: "Queen's Club",
  terrawortmann: 'Halle',
  libema: "'s-Hertogenbosch",
  boss: 'Boss Open',
  generali: 'Kitzbuhel',
  generalikitzbhel: 'Kitzbuhel',
  efgswissgstaad: 'Gstaad',
  nordea: 'Bastad',
  millenniumestoril: 'Estoril',
  mubadaladc: 'Washington',
  nationalbank: 'Canada',
  plavalagunacroatiaumag: 'Umag',
  mifeltelceloppo: 'Los Cabos',
  ceritypartnershalloffame: 'Newport',
  abiertognpseguros: 'Monterrey',
  odlumbrownvanopen: 'Vancouver',
  lexuseastbourne: 'Eastbourne',
  lexusbirmingham: 'Birmingham',
  lexusnottingham: 'Nottingham',
  lexusilkley: 'Ilkley',
  vandapharmaceuticalsmallorca: 'Mallorca',
  vandapharmaceuticalsberlin: 'Berlin',
  vandapharmaceuticalsathens: 'Athens',
  femminilibrescia: 'Brescia',
  livesportprague: 'Prague',
  unicreditiasi: 'Iasi',
  warsawtmobilepolish: 'Warsaw',
  ennoblecarephilly: 'Philadelphia',
  // Deliberately NOT mapped to their city: "MSC Hamburg Ladies Open" is a July
  // WTA event distinct from May's ATP Bitpanda Hamburg Open, and the ATP Boss
  // Open is grass in Stuttgart in June while the WTA Porsche Grand Prix is
  // indoor clay there in April. One city, two tournaments — merging on the city
  // claims a single event ran for two months on two surfaces.
}

/** Davis Cup and BJK Cup arrive one tie per row: "Davis Cup QLS R1: AUS vs ECU". */
function teamEvent(name: string): string | null {
  if (/davis\s*cup/i.test(name)) return 'Davis Cup'
  if (/bjk\s*cup|billie\s*jean\s*king\s*cup/i.test(name)) return 'BJK Cup'
  return null
}

/**
 * The display name every source spelling collapses onto. This is what the
 * index stores as `name` and what the tournament page shows as its title.
 */
export function canonicalName(raw: string): string {
  const name = (raw ?? '').trim()
  if (!name) return ''

  const team = teamEvent(name)
  if (team) return team

  const whole = normalizeName(name)
  if (SLAMS[whole]) return SLAMS[whole]

  // Sponsor clauses trail the real name; years, parentheticals and "for the
  // <something> Cup" are decoration.
  let cleaned = name
    .replace(/\s+(presented|powered|sponsored)\s+by\s+.*$/i, '')
    .replace(/\s+for\s+the\s+.*$/i, '')
    .replace(/\(.*?\)/g, '')
    .replace(/\b20\d\d\b/g, '')

  const words = cleaned.split(/[^A-Za-z0-9']+/).filter(Boolean)
  const kept = words.filter(w => !GENERIC.has(normalizeName(w)))

  const key = normalizeName(kept.join(''))
  if (SLAMS[key]) return SLAMS[key]
  if (ALIASES[key]) return ALIASES[key]

  // Everything was generic ("Open", "The Championships"). Fall back to the
  // whole name rather than returning nothing addressable.
  if (!kept.length) {
    if (SLAMS[whole]) return SLAMS[whole]
    if (ALIASES[whole]) return ALIASES[whole]
    return name
  }

  return kept.join(' ')
}

/** Comparison key. Two spellings of one event share it; two events never do. */
export function canonicalTournament(raw: string): string {
  return normalizeName(canonicalName(raw))
}

/** URL segment. Stable for a season, and a fixed point under re-slugging. */
export function tournamentSlug(raw: string): string {
  const canonical = canonicalName(raw)
  const slug = canonical
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    // Apostrophes close up rather than becoming separators, so Queen's Club is
    // queens-club and not queen-s-club.
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || normalizeName(raw) || 'unknown'
}
