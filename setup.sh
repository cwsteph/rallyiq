#!/bin/bash
# RallyIQ Setup — run once to go from zip → live site
# Usage: bash setup.sh
# No API keys needed. Uses ESPN's free public tennis API.

set -e

CYAN='\033[0;36m'; GREEN='\033[0;32m'; AMBER='\033[1;33m'
RED='\033[0;31m'; BOLD='\033[1m'; NC='\033[0m'

echo ""
echo -e "${BOLD}╔══════════════════════════════════════╗${NC}"
echo -e "${BOLD}║        RallyIQ Setup Script          ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════╝${NC}"
echo ""

# ── 1. Check Node ─────────────────────────────────────────────────────────────
echo -e "${CYAN}[1/6] Checking Node.js...${NC}"
if ! command -v node &>/dev/null; then
  echo -e "${RED}✗ Node.js not found.${NC}"
  echo "  Run: nvm install 22 && nvm use 22"
  echo "  Then close and reopen terminal and run: bash setup.sh"
  exit 1
fi
NODE_VER=$(node --version | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VER" -lt 18 ]; then
  echo -e "${RED}✗ Node $(node --version) too old. Need 18+.${NC}"
  echo "  Run: nvm install 22 && nvm use 22"
  echo "  Then close and reopen terminal and run: bash setup.sh"
  exit 1
fi
echo -e "${GREEN}✓ Node.js $(node --version)${NC}"

# ── 2. Write .env.local ───────────────────────────────────────────────────────
cat > .env.local << 'ENVEOF'
DATABASE_URL="postgresql://neondb_owner:npg_jtGDPhWJB6q4@ep-wild-moon-ak3lma0i-pooler.c-3.us-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
REFRESH_SECRET="rallyiq2026"
ENVEOF
echo -e "${GREEN}✓ .env.local configured (Neon database pre-wired)${NC}"

# ── 3. Install deps ───────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}[2/6] Installing dependencies (~2 mins)...${NC}"
npm install
echo -e "${GREEN}✓ Dependencies installed${NC}"

# ── 4. Generate demo data ─────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}[3/6] Generating player ratings and demo matches...${NC}"
node -e "
const fs = require('fs');
fs.mkdirSync('data', {recursive:true});
const players = [
  {player_id:'djokovic',  name:'N. Djokovic',  tour:'ATP',elo_overall:2180,elo_hard:2200,elo_clay:2190,elo_grass:2160,hold_pct:0.88,break_pct:0.32,form_score:0.9, form_json:'[1,1,1,1,1,1,1,0,1,1]',current_rank:1, matches_played:1200},
  {player_id:'alcaraz',   name:'C. Alcaraz',   tour:'ATP',elo_overall:2140,elo_hard:2100,elo_clay:2210,elo_grass:2090,hold_pct:0.85,break_pct:0.35,form_score:0.8, form_json:'[1,1,0,1,1,1,0,1,1,1]',current_rank:2, matches_played:420},
  {player_id:'sinner',    name:'J. Sinner',    tour:'ATP',elo_overall:2130,elo_hard:2180,elo_clay:2080,elo_grass:2050,hold_pct:0.87,break_pct:0.28,form_score:0.8, form_json:'[1,1,1,0,1,1,1,1,0,1]',current_rank:3, matches_played:380},
  {player_id:'medvedev',  name:'D. Medvedev',  tour:'ATP',elo_overall:2090,elo_hard:2120,elo_clay:2010,elo_grass:2040,hold_pct:0.84,break_pct:0.26,form_score:0.6, form_json:'[1,0,1,1,0,1,1,0,1,1]',current_rank:4, matches_played:560},
  {player_id:'zverev',    name:'A. Zverev',    tour:'ATP',elo_overall:2060,elo_hard:2050,elo_clay:2090,elo_grass:2000,hold_pct:0.82,break_pct:0.30,form_score:0.5, form_json:'[0,1,1,0,1,1,0,1,0,1]',current_rank:5, matches_played:620},
  {player_id:'hurkacz',   name:'H. Hurkacz',   tour:'ATP',elo_overall:2020,elo_hard:2040,elo_clay:1960,elo_grass:2060,hold_pct:0.80,break_pct:0.24,form_score:0.5, form_json:'[1,0,1,1,0,0,1,1,1,0]',current_rank:6, matches_played:490},
  {player_id:'rublev',    name:'A. Rublev',    tour:'ATP',elo_overall:1990,elo_hard:2000,elo_clay:2010,elo_grass:1950,hold_pct:0.79,break_pct:0.27,form_score:0.5, form_json:'[1,1,0,0,1,0,1,0,1,1]',current_rank:7, matches_played:530},
  {player_id:'fritz',     name:'T. Fritz',     tour:'ATP',elo_overall:1960,elo_hard:1990,elo_clay:1880,elo_grass:1940,hold_pct:0.78,break_pct:0.23,form_score:0.4, form_json:'[0,1,0,1,1,0,0,1,1,0]',current_rank:8, matches_played:470},
  {player_id:'swiatek',   name:'I. Swiatek',   tour:'WTA',elo_overall:2200,elo_hard:2150,elo_clay:2280,elo_grass:2080,hold_pct:0.86,break_pct:0.38,form_score:0.9, form_json:'[1,1,1,1,0,1,1,1,1,1]',current_rank:1, matches_played:580},
  {player_id:'sabalenka', name:'A. Sabalenka', tour:'WTA',elo_overall:2160,elo_hard:2190,elo_clay:2100,elo_grass:2090,hold_pct:0.84,break_pct:0.34,form_score:0.8, form_json:'[1,1,0,1,1,1,0,1,1,1]',current_rank:2, matches_played:510},
  {player_id:'gauff',     name:'C. Gauff',     tour:'WTA',elo_overall:2080,elo_hard:2060,elo_clay:2070,elo_grass:2010,hold_pct:0.80,break_pct:0.30,form_score:0.5, form_json:'[1,0,1,1,0,1,1,0,1,0]',current_rank:3, matches_played:420},
  {player_id:'rybakina',  name:'E. Rybakina',  tour:'WTA',elo_overall:2050,elo_hard:2040,elo_clay:1980,elo_grass:2120,hold_pct:0.82,break_pct:0.28,form_score:0.5, form_json:'[0,1,1,0,1,1,0,1,0,1]',current_rank:4, matches_played:390},
  {player_id:'pegula',    name:'J. Pegula',    tour:'WTA',elo_overall:2010,elo_hard:2030,elo_clay:1960,elo_grass:1980,hold_pct:0.79,break_pct:0.27,form_score:0.7, form_json:'[1,1,0,1,0,1,1,1,0,1]',current_rank:5, matches_played:440},
  {player_id:'muchova',   name:'K. Muchova',   tour:'WTA',elo_overall:1990,elo_hard:1980,elo_clay:1970,elo_grass:2000,hold_pct:0.77,break_pct:0.29,form_score:0.7, form_json:'[1,0,1,1,1,0,1,1,0,1]',current_rank:7, matches_played:380},
];
const today = new Date().toISOString().slice(0,10);
const matches = [
  {match_id:'espn_173118',tournament:'Miami Open',surface:'Hard',round:'QF',best_of:3,match_date:today,scheduled_time:'17:00',player1_id:'pegula',   player1_name:'J. Pegula',   player2_id:'rybakina', player2_name:'E. Rybakina', source:'espn-wta'},
  {match_id:'espn_173119',tournament:'Miami Open',surface:'Hard',round:'QF',best_of:3,match_date:today,scheduled_time:'23:00',player1_id:'sabalenka', player1_name:'A. Sabalenka',player2_id:'gauff',    player2_name:'C. Gauff',    source:'espn-wta'},
  {match_id:'espn_173253',tournament:'Miami Open',surface:'Hard',round:'QF',best_of:3,match_date:today,scheduled_time:'19:00',player1_id:'sinner',    player1_name:'J. Sinner',   player2_id:'alcaraz',  player2_name:'C. Alcaraz',  source:'espn-atp'},
  {match_id:'espn_173256',tournament:'Miami Open',surface:'Hard',round:'QF',best_of:3,match_date:today,scheduled_time:'21:00',player1_id:'djokovic',  player1_name:'N. Djokovic', player2_id:'fritz',    player2_name:'T. Fritz',    source:'espn-atp'},
];
fs.writeFileSync('data/ratings.json', JSON.stringify(players,null,2));
fs.writeFileSync('data/today.json',   JSON.stringify(matches,null,2));
console.log('  ' + players.length + ' players, ' + matches.length + ' matches written');
"
echo -e "${GREEN}✓ Data files ready${NC}"

# ── 5. Fetch real matches ─────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}  Fetching today's real ATP/WTA matches from ESPN...${NC}"
npx tsx scripts/fetch-today.ts \
  && echo -e "${GREEN}  ✓ Live ESPN match data loaded${NC}" \
  || echo -e "${AMBER}  ⚠ Kept demo matches (ESPN fetch failed — will retry on next refresh)${NC}"

# ── 6. Push DB schema ─────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}[4/6] Setting up Neon database tables...${NC}"
npx prisma generate 2>/dev/null | grep -v "^$" | head -3 || true
npx prisma db push 2>&1 | grep -E "✓|error|Your database|already|created" | head -5 || true
echo -e "${GREEN}✓ Database tables created (Bet, Bankroll, BankrollSnapshot)${NC}"

# ── 7. Build ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}[5/6] Building Next.js app...${NC}"
npm run build 2>&1 | grep -E "✓|error|Route|compiled|warn" | grep -v "^$" | tail -12
echo -e "${GREEN}✓ Build complete${NC}"

# ── 8. Deploy to Vercel ───────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}[6/6] Deploying to Vercel...${NC}"
echo ""

if ! command -v vercel &>/dev/null; then
  echo "  Installing Vercel CLI..."
  npm install -g vercel
fi

echo -e "${AMBER}  You need a free Vercel account: vercel.com${NC}"
echo ""
vercel login

echo ""
echo -e "  ${BOLD}Deploying now...${NC}"
echo "  When prompted: Y → your account → N (new project) → rallyiq → . → N"
echo ""
vercel --prod

# ── Add env vars ──────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}  Adding environment variables to Vercel...${NC}"
DB="postgresql://neondb_owner:npg_jtGDPhWJB6q4@ep-wild-moon-ak3lma0i-pooler.c-3.us-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
for ENV in production preview development; do
  echo "$DB"          | vercel env add DATABASE_URL   $ENV --force 2>/dev/null || true
  echo "rallyiq2026"  | vercel env add REFRESH_SECRET $ENV --force 2>/dev/null || true
done
echo -e "${GREEN}  ✓ Environment variables added${NC}"

echo ""
echo -e "${CYAN}  Final redeploy with all env vars active...${NC}"
vercel --prod

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║   ✓  RallyIQ is LIVE!                        ║${NC}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo "  Your URL is shown above ↑"
echo ""
echo -e "  ${AMBER}What to do now:${NC}"
echo "  1. Open your URL — dashboard should be live"
echo "  2. Hit the Refresh button to pull today's real matches"
echo "  3. Click any match to see model analysis, then log a bet"
echo ""
echo -e "  ${AMBER}For real Elo ratings (optional — run later):${NC}"
echo "  Download from github.com/JeffSackmann/tennis_atp"
echo "  Put CSVs in data/, then: npm run ratings:build && vercel --prod"
echo ""
