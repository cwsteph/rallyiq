const fs = require('fs');
const path = require('path');

console.log('Building ratings from CSV files...');
const dataDir = 'data';
const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.csv'));
console.log('Found:', files.join(', '));

const BASE_ELO = 1500, K = 32;
const players = new Map();

function getOrCreate(id, name, tour) {
  if (!players.has(id)) {
    players.set(id, {
      player_id: id, name, tour,
      elo_overall: BASE_ELO, elo_hard: BASE_ELO, elo_clay: BASE_ELO, elo_grass: BASE_ELO,
      hold_pct: 0.75, break_pct: 0.25, form_score: 0.5, form_json: '[]',
      current_rank: null, matches_played: 0, _form: []
    });
  }
  return players.get(id);
}

function eloUpdate(w, l, k) {
  const exp = 1 / (1 + Math.pow(10, (l - w) / 400));
  return {
    w: Math.round((w + k * (1 - exp)) * 10) / 10,
    l: Math.round((l + k * (0 - (1 - exp))) * 10) / 10
  };
}

for (const file of files) {
  const tour = file.startsWith('wta') ? 'WTA' : 'ATP';
  const content = fs.readFileSync(path.join(dataDir, file), 'utf8');
  const lines = content.split('\n');
  const headers = lines[0].split(',');
  const idx = (n) => headers.indexOf(n);

  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const cols = line.split(',');
    const wId = cols[idx('winner_id')]?.trim();
    const lId = cols[idx('loser_id')]?.trim();
    const wName = cols[idx('winner_name')]?.trim();
    const lName = cols[idx('loser_name')]?.trim();
    const surface = cols[idx('surface')]?.trim();
    if (!wId || !lId || !wName || !lName) continue;

    const w = getOrCreate(wId, wName, tour);
    const l = getOrCreate(lId, lName, tour);

    const ov = eloUpdate(w.elo_overall, l.elo_overall, K);
    w.elo_overall = ov.w; l.elo_overall = ov.l;

    const surfKey = surface === 'Clay' ? 'elo_clay' : surface === 'Grass' ? 'elo_grass' : 'elo_hard';
    const sv = eloUpdate(w[surfKey], l[surfKey], 24);
    w[surfKey] = sv.w; l[surfKey] = sv.l;

    w._form = [1, ...w._form].slice(0, 10);
    l._form = [0, ...l._form].slice(0, 10);
    w.form_score = Math.round(w._form.reduce((a,b)=>a+b,0) / w._form.length * 1000) / 1000;
    l.form_score = Math.round(l._form.reduce((a,b)=>a+b,0) / l._form.length * 1000) / 1000;
    w.form_json = JSON.stringify(w._form);
    l.form_json = JSON.stringify(l._form);
    w.matches_played++; l.matches_played++;
  }
  console.log('Processed:', file, '- players so far:', players.size);
}

const ratings = Array.from(players.values()).map(({_form, ...p}) => p);
fs.writeFileSync('data/ratings.json', JSON.stringify(ratings, null, 2));
console.log('Done:', ratings.length, 'players written to data/ratings.json');

// Show top 5 by elo
const top5 = ratings.sort((a,b) => b.elo_overall - a.elo_overall).slice(0,5);
console.log('Top 5:', top5.map(p => p.name + ' ' + p.elo_overall).join(', '));
