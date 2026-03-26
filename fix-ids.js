const fs = require('fs');
const ratings = JSON.parse(fs.readFileSync('data/ratings.json','utf8'));
const today = JSON.parse(fs.readFileSync('data/today.json','utf8'));

const nameMap = new Map();
const lastNameMap = new Map();
for (const r of ratings) {
  nameMap.set(r.name.toLowerCase(), r.player_id);
  const last = r.name.split(' ').pop().toLowerCase();
  if (!lastNameMap.has(last)) lastNameMap.set(last, r.player_id);
}

let matched = 0;
const updated = today.map(m => {
  const p1Last = m.player1_name.split(' ').pop().toLowerCase();
  const p2Last = m.player2_name.split(' ').pop().toLowerCase();
  const p1Id = nameMap.get(m.player1_name.toLowerCase()) || lastNameMap.get(p1Last) || m.player1_id;
  const p2Id = nameMap.get(m.player2_name.toLowerCase()) || lastNameMap.get(p2Last) || m.player2_id;
  if (p1Id !== m.player1_id || p2Id !== m.player2_id) matched++;
  return { ...m, player1_id: p1Id, player2_id: p2Id };
});

fs.writeFileSync('data/today.json', JSON.stringify(updated, null, 2));
console.log('Updated', matched, 'of', today.length, 'matches with real player IDs');
updated.forEach(m => console.log(m.player1_name, '->', m.player1_id, '|', m.player2_name, '->', m.player2_id));
