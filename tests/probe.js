/* probe: why mirror games grind to the turn limit? */
const fs = require('fs'), vm = require('vm');
let code = '';
for (const p of ['p01_core.js', 'p02_i18n.js', 'p03_data.js', 'p04_stages.js', 'p05_rules.js', 'p06_ai.js']) {
  code += fs.readFileSync('parts/' + p, 'utf8') + '\n';
}
const sb = { console }; vm.createContext(sb); vm.runInContext(code, sb);
const HF = sb.HF;

for (const idx of [0, 2, 5, 8]) {
  const s = HF.newGame(idx, 'normal');
  let minDist = 99, sitOnHq = 0, hqfire = 0, caps = 0;
  const ownTrack = [];
  const feed = (evs) => { for (const e of evs || []) { if (e.k === 'hqfire') hqfire++; if (e.k === 'capture') caps++; } };
  while (!s.over && s.turn <= s.limit) {
    feed(HF.aiTurn(s)); feed(HF.endTurn(s));
    if (s.over) break;
    feed(HF.aiTurn(s)); feed(HF.endTurn(s));
    if (s.over) break;
    for (const u of s.units) if (u.i === s.hq[1 - u.side]) sitOnHq++;
    for (const u of s.units) {
      if (!HF.UNITS[u.t].cap) continue;
      const d = HF.distIdx(s, u.i, s.hq[1 - u.side]);
      if (d < minDist) minDist = d;
    }
    const own0 = s.cells.filter(c => c.own === 0 && HF.TERR[c.t].cap).length;
    const own1 = s.cells.filter(c => c.own === 1 && HF.TERR[c.t].cap).length;
    ownTrack.push(own0 + '/' + own1);
  }
  console.log('ST' + HF.STAGES[idx].id, 'turns=' + s.turn, 'why=' + (s.over && s.over.why), 'win=' + (s.over && s.over.win),
    'sitOnHq=' + sitOnHq, 'hqfire=' + hqfire, 'captures=' + caps, 'minInfDistToFoeHQ=' + minDist,
    'score=' + HF.score(s, 0) + '/' + HF.score(s, 1), 'props 0/1 last:', ownTrack.slice(-3).join(' '));
}
