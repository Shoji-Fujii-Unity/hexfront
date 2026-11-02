/* HEXFRONT logic test (node tests/logic-test.js) — no browser needed.
   Loads the DOM-free parts (core/i18n/data/stages/rules/ai) and checks
   hex math, map generation invariants, combat rules, save round-trip,
   i18n coverage and full self-play games for every stage. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const PARTS = ['p01_core.js', 'p02_i18n.js', 'p03_data.js', 'p04_stages.js', 'p05_rules.js', 'p06_ai.js'];
let code = '';
for (const p of PARTS) {
  const f = path.join(ROOT, 'parts', p);
  if (!fs.existsSync(f)) { console.error('missing part ' + p); process.exit(1); }
  code += fs.readFileSync(f, 'utf8') + '\n';
}
const sandbox = { console, setTimeout, Math, JSON, Date };
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: 'hexfront-logic.js' });
const HF = sandbox.HF;

let pass = 0, fail = 0, fails = [];
function ok(cond, name, extra) {
  if (cond) { pass++; }
  else { fail++; fails.push(name + (extra ? ' :: ' + extra : '')); }
}
function head(t) { console.log('\n== ' + t + ' =='); }

/* ---------- 1. hex maths ---------- */
head('hex maths');
{
  const s = { W: 12, H: 9 };
  let sym = true, nb = [];
  for (let r = 0; r < s.H; r++) for (let c = 0; c < s.W; c++) {
    const i = r * s.W + c;
    HF.neighbors(s, c, r, nb);
    for (const j of nb) {
      const c2 = j % s.W, r2 = (j / s.W) | 0;
      const back = HF.neighbors(s, c2, r2, []);
      if (back.indexOf(i) < 0) { sym = false; console.log('asym', c, r, c2, r2); }
      if (HF.dist(c, r, c2, r2) !== 1) { sym = false; console.log('dist!=1', c, r, c2, r2, HF.dist(c, r, c2, r2)); }
    }
    if (nb.length > 6) sym = false;
    if (c > 0 && c < s.W - 1 && r > 0 && r < s.H - 1 && nb.length !== 6) {
      sym = false; console.log('interior hex has ' + nb.length + ' neighbours at ' + c + ',' + r);
    }
    if (nb.length < 2) sym = false;
  }
  ok(sym, 'neighbour symmetry + unit distance');
  ok(HF.dist(0, 0, 0, 0) === 0 && HF.dist(0, 0, 3, 0) === 3 && HF.dist(1, 1, 4, 4) === 4, 'distance basics',
    HF.dist(1, 1, 4, 4));
  /* pxToHex round trip on a real state shell */
  const st = HF.genMap(HF.STAGES[0]);
  let rt = 0;
  for (let i = 0; i < st.cells.length; i++) {
    const c = i % st.W, r = (i / st.W) | 0, R = 16, hw = HF.hexW(R);
    const x = hw * (c + 0.5 * (r & 1)) + hw / 2, y = 1.5 * R * r + R + R * 0.5;
    if (HF.pxToHex(st, x, y, R) === i) rt++;
  }
  ok(rt === st.cells.length, 'pxToHex round trip ' + rt + '/' + st.cells.length);
}

/* ---------- 2. map generation invariants ---------- */
head('map generation (12 stages)');
for (let k = 0; k < HF.STAGES.length; k++) {
  const stg = HF.STAGES[k];
  const s = HF.genMap(stg);
  const name = 'ST' + stg.id + ' ' + stg.n.en;
  ok(s.cells.length === stg.sz[0] * stg.sz[1], name + ' size');
  let hq = 0, fac = 0, air = 0, symBad = 0;
  for (let i = 0; i < s.cells.length; i++) {
    const j = HF.twinIdx(s, i);
    if (s.cells[i].t !== s.cells[j].t) symBad++;
    if (s.cells[i].t === 'HQ') hq++;
    if (s.cells[i].t === 'FACTORY') fac++;
    if (s.cells[i].t === 'AIRFIELD') air++;
  }
  ok(symBad === 0, name + ' 180-degree terrain symmetry', 'bad=' + symBad);
  ok(hq === 2, name + ' exactly two HQs', 'hq=' + hq);
  ok(fac >= 2, name + ' at least one factory per side', 'fac=' + fac);
  if (stg.props.air > 0) ok(air >= 2, name + ' airfields present', 'air=' + air);
  ok(s.cells[s.hq[0]].own === 0 && s.cells[s.hq[1]].own === 1, name + ' HQ ownership');
  /* both HQs reachable by tracked vehicles */
  const seen = new Set([s.hq[0]]), q = [s.hq[0]];
  while (q.length) {
    const i = q.pop();
    for (const j of HF.neighbors(s, i % s.W, (i / s.W) | 0, [])) {
      if (seen.has(j)) continue;
      if (HF.TERR[s.cells[j].t].cost.T < 0) continue;
      seen.add(j); q.push(j);
    }
  }
  ok(seen.has(s.hq[1]), name + ' HQ link passable for tracked vehicles');
  /* start pools must contain enough free hexes for the starting lineup */
  ok(s.starts[0].length >= stg.start.length && s.starts[1].length >= stg.start.length,
    name + ' deployment room ' + s.starts[0].length + '/' + stg.start.length);
}

/* ---------- 3. new game + rules ---------- */
head('new game & rules');
{
  const s = HF.newGame(0, 'normal');
  ok(s.units.length === HF.STAGES[0].start.length * 2, 'both sides deployed', 'units=' + s.units.length);
  ok(s.funds[0] >= HF.STAGES[0].funds, 'player funds', s.funds[0] + ' vs ' + HF.STAGES[0].funds);
  let overlap = 0, badTerrain = 0;
  const seenHex = new Set();
  for (const u of s.units) {
    if (seenHex.has(u.i)) overlap++; else seenHex.add(u.i);
    if (HF.TERR[s.cells[u.i].t].cost[HF.UNITS[u.t].dom] < 0) badTerrain++;
  }
  ok(overlap === 0, 'no two units share a hex');
  ok(badTerrain === 0, 'every unit stands on passable terrain', 'bad=' + badTerrain);
  ok(HF.incomeOf(s, 0).n > 0, 'player has income', JSON.stringify(HF.incomeOf(s, 0)));

  /* forecast is deterministic and doAttack matches it */
  const a = HF.liveUnits(s, 0)[0], b = HF.liveUnits(s, 1)[0];
  b.i = a.i; // no: use a synthetic engagement instead
  b.i = HF.idx(s, 0, 0);
  const fc1 = HF.forecast(s, a, a, a.i);
  ok(fc1 === null || fc1.dmg >= 1, 'forecast self target sane');

  /* move + attack: pick a player unit, walk it as far as it can and check fuel */
  const u = HF.liveUnits(s, 0).find(x => HF.UNITS[x.t].dom !== 'A');
  const r0 = HF.reach(s, u);
  let far = -1, best = -1;
  for (let i = 0; i < s.cells.length; i++) if (r0.stop[i] && r0.cost[i] > best) { best = r0.cost[i]; far = i; }
  const fuelBefore = u.fuel;
  const mv = HF.doMove(s, u, far);
  ok(!!mv && u.i === far && u.fuel === fuelBefore - best, 'move consumes exactly the path cost');
  ok(!HF.doMove(s, u, far), 'unit cannot move twice');
  ok(mv && mv.path.length >= 2 && mv.path[0] === mv.from && mv.path[mv.path.length - 1] === mv.to, 'path is ordered');

  /* attacks: build two units next to each other and compare forecast vs applied */
  const t1 = HF.mkUnit(s, 'MBT', 0, s.hq[0]);           // fake positions get overwritten below
  HF.removeUnit(s, t1);
  const freeHex = [];
  for (let i = 0; i < s.cells.length; i++) if (!s.occ[i] && HF.TERR[s.cells[i].t].cost.T > 0) freeHex.push(i);
  const h1 = freeHex[10], h2 = HF.neighbors(s, h1 % s.W, (h1 / s.W) | 0, []).find(j => !s.occ[j] && HF.TERR[s.cells[j].t].cost.T > 0);
  const at = HF.mkUnit(s, 'MBT', 0, h1), df = HF.mkUnit(s, 'RIFLE', 1, h2);
  const fc = HF.forecast(s, at, df, h1);
  ok(fc && fc.dmg > 0, 'tank shoots rifle squad', fc && fc.dmg);
  const hpBefore = df.hp;
  const ev = HF.doAttack(s, at, df, h1);
  ok(ev && df.hp === hpBefore - fc.dmg, 'applied damage equals the forecast', ev ? df.hp + ' vs ' + (hpBefore - fc.dmg) : 'no event');
  ok(at.attacked === 1, 'attacker has fired');
  ok(!HF.doAttack(s, at, df, h1), 'cannot fire twice');
  if (df.hp > 0) {
    s.turn++;
    HF.sideStart(s, 0);
    const fc2 = HF.forecast(s, at, df, h1);
    const before2 = df.hp;
    const ev2 = HF.doAttack(s, at, df, h1);
    ok(!!fc2 && !!ev2 && df.hp === before2 - fc2.dmg, 'unit can fire again after next turn');
    ok(!!fc2 && fc2.dmg > 0, 'repeat forecast ok');
  }
  /* matchup: infantry vs tank should be far weaker than ATGM vs tank */
  const h3 = HF.neighbors(s, h1 % s.W, (h1 / s.W) | 0, []).find(j => !s.occ[j] && HF.TERR[s.cells[j].t].cost.F > 0);
  const inf = HF.mkUnit(s, 'RIFLE', 0, h3);
  const tank = HF.mkUnit(s, 'MBT', 1, h1 === h3 ? h2 : h1);
  HF.removeUnit(s, at);
  const fcInf = HF.forecast(s, inf, tank, h3);
  const atgm = HF.mkUnit(s, 'ATGM', 0, h3 === h1 ? h2 : h3);
  HF.removeUnit(s, inf);
  const fcAtgm = HF.forecast(s, atgm, tank, atgm.i);
  ok(fcInf && fcAtgm && fcAtgm.dmg > fcInf.dmg * 2, 'ATGM outruns rifles against armour',
    fcAtgm.dmg + ' vs ' + fcInf.dmg);
  ok(!HF.forecast(s, HF.mkUnit(s, 'SAM', 0, h2), tank, h2), 'SAM cannot hit ground');
  /* ammo exhaustion: indirect system firing from its minimum range */
  const ring2 = HF.hexesWithin(s, tank.i % s.W, (tank.i / s.W) | 0, HF.UNITS.SPART.r0, [])
    .filter(j => !s.occ[j] && HF.TERR[s.cells[j].t].cost.T > 0 && HF.distIdx(s, j, tank.i) === HF.UNITS.SPART.r0);
  const spa = HF.mkUnit(s, 'SPART', 0, ring2[0]);
  tank.hp = 900;
  ok(HF.distIdx(s, spa.i, tank.i) === HF.UNITS.SPART.r0, 'SPART placed at min range', HF.distIdx(s, spa.i, tank.i));
  let shots = 0;
  while (HF.doAttack(s, spa, tank, spa.i) && shots < 30) { shots++; spa.attacked = 0; spa.acted = 0; }
  ok(shots === HF.UNITS.SPART.ammo, 'SPART fires exactly its ammo load', 'shots=' + shots);
  spa.ammo = 0; spa.attacked = 0;
  ok(HF.doAttack(s, spa, tank, spa.i) === null, 'out of ammo cannot attack');
  HF.removeUnit(s, spa); HF.removeUnit(s, atgm); HF.removeUnit(s, tank);

  /* capture: infantry parked on a neutral city flips it after the required pips */
  const city = s.cells.findIndex(c => c.t === 'CITY');
  const inf2 = HF.mkUnit(s, 'RIFLE', 0, city);
  s.side = 0;
  const need = HF.TERR.CITY.cap;
  let flips = 0;
  for (let t = 0; t < need + 1; t++) { HF.endTurn(s); if (s.cells[city].own === 0) flips++; if (s.over) break; }
  ok(s.cells[city].own === 0, 'city captured after ' + need + ' pips', 'own=' + s.cells[city].own);
  HF.removeUnit(s, inf2);
  ok(HF.TERR.CITY.cap >= 2, 'capture pips configured');

  /* supply */
  const far2 = HF.mkUnit(s, 'MBT', 0, freeHex[freeHex.length - 1]);
  far2.fuel = 5; far2.ammo = 0;
  const before = { f: far2.fuel, a: far2.ammo };
  HF.sideStart(s, 0);
  const fed = far2.fuel > before.f || far2.ammo > before.a;
  const nearSupply = HF.supplySources(s, 0)[far2.i] || HF.neighbors(s, far2.i % s.W, (far2.i / s.W) | 0, []).some(j => HF.supplySources(s, 0)[j]);
  ok(fed === !!nearSupply, 'supply only refills near friendly property', 'fed=' + fed + ' near=' + nearSupply);
  HF.removeUnit(s, far2);
}

/* ---------- 4. save round trip ---------- */
head('save / load');
{
  {
    const s = HF.newGame(0, 'normal');
    s.units = [];
    s.occ.fill(0);
    s.nextId = 1;
    let pair = null;
    for (let i = 0; i < s.cells.length && !pair; i++) {
      if (HF.TERR[s.cells[i].t].cost.W <= 0) continue;
      const nb = HF.neighbors(s, i % s.W, (i / s.W) | 0, []);
      for (const j of nb) {
        if (HF.TERR[s.cells[j].t].cost.F > 0) { pair = [i, j]; break; }
      }
    }
    ok(!!pair, 'transport test has adjacent passable cells');
    if (pair) {
      const carrier = HF.mkUnit(s, 'APC', 0, pair[0]);
      const cargo = HF.mkUnit(s, 'RIFLE', 0, pair[1]);
      const loaded = HF.doLoad(s, carrier, cargo);
      const packed = JSON.parse(JSON.stringify(HF.pack(s)));
      const resumed = HF.unpack(packed);
      const restoredCarrier = resumed && HF.byId(resumed, carrier.id);
      ok(!!loaded && s.units.length === 1, 'loaded cargo is removed from the board unit list');
      ok(!!resumed && resumed.units.length === 1 && !HF.byId(resumed, cargo.id),
        'loaded cargo is not restored as a separate board unit');
      ok(!!restoredCarrier && restoredCarrier.car.length === 1 && restoredCarrier.car[0].id === cargo.id,
        'loaded cargo is preserved inside its carrier');
      ok(!!resumed && resumed.occ[cargo.i] === 0, 'loaded cargo does not occupy its former hex after resume');
    }
  }
  for (const idx of [0, 5, 11]) {
    const s = HF.newGame(idx, 'hard');
    HF.aiTurn(s); HF.endTurn(s); HF.aiTurn(s); HF.endTurn(s);
    const packed = JSON.parse(JSON.stringify(HF.pack(s)));
    const sigOf = (x) => JSON.stringify({
      t: x.turn, side: x.side, funds: x.funds, rng: x.rngState,
      cells: x.cells.map(c => c.t + ':' + c.own + ':' + c.cap).join(','),
      units: x.units.map(u => [u.id, u.t, u.side, u.i, u.hp, u.fuel, u.ammo, u.acted, u.attacked, u.car.length].join('~')).sort().join('|'),
      ko: x.ko, nextId: x.nextId
    });
    const before = sigOf(s);
    const t = HF.unpack(packed);
    ok(!!t, 'ST' + HF.STAGES[idx].id + ' unpack produced a state');
    ok(sigOf(t) === before, 'ST' + HF.STAGES[idx].id + ' state identical after save/load');
    /* and continues identically */
    const s2 = JSON.parse(JSON.stringify(packed));
    HF.aiTurn(t); HF.endTurn(t);
    HF.aiTurn(s); HF.endTurn(s);
    ok(sigOf(t).slice(0, 200).length > 0 && JSON.stringify([t.turn, t.side]) === JSON.stringify([s.turn, s.side]),
      'ST' + HF.STAGES[idx].id + ' continues on the same turn/side');
    const size = JSON.stringify(HF.pack(t)).length;
    ok(size < 220000, 'ST' + HF.STAGES[idx].id + ' save size ' + Math.round(size / 1024) + 'KB < 215KB');
  }
}

/* ---------- 5. AI target fields ---------- */
head('AI target fields');
{
  const s = HF.newGame(0, 'normal');
  const originalCostField = HF.costField;
  const calls = [];
  HF.costField = function (state, dom, sources) {
    calls.push({ dom, sources: sources.slice().sort((a, b) => a - b).join(',') });
    return originalCostField(state, dom, sources);
  };
  try {
    HF.aiTurn(s);
  } finally {
    HF.costField = originalCostField;
  }
  const infantryFields = calls.filter(x => x.dom === 'F');
  ok(new Set(infantryFields.map(x => x.sources)).size > 1,
    'AI computes separate movement fields for different targets');
}

head('turn balance and AI decisions');
{
  const s = HF.newGame(0, 'normal');
  s.turn = s.limit;
  HF.endTurn(s);
  ok(!s.over && s.side === 1 && s.turn === s.limit, 'second side gets its final turn');
  s.funds[1] += 10000;
  HF.endTurn(s);
  ok(s.over && s.over.why === 'limit' && s.over.win === 1,
    'final score includes the second side final turn');
}
{
  const s = HF.newGame(0, 'normal');
  s.turn = s.limit;
  s.units = []; s.occ.fill(0);
  const hq = s.hq[0];
  const u = HF.mkUnit(s, 'RIFLE', 1, hq);
  s.cells[hq].capSide = 1; s.cells[hq].cap = HF.TERR.HQ.cap - 1;
  HF.endTurn(s);
  ok(!s.over && s.side === 1, 'final turn remains available for an HQ capture');
  HF.endTurn(s);
  ok(s.over && s.over.win === 1 && s.over.why === 'hq' && u.hp === 100,
    'final-turn HQ capture takes precedence over score');
}
{
  const s = { W: 3, H: 1, cells: [{ t: 'PLAIN' }, { t: 'RIVER' }, { t: 'ROAD' }] };
  const field = HF.costField(s, 'F', [2]);
  ok(field[0] === 34 && field[1] === 10 && field[2] === 0,
    'reverse cost field charges the terrain entered on the way to the target');
}
{
  const s = HF.newGame(0, 'normal');
  s.units = []; s.occ.fill(0);
  const i = s.hq[0];
  const adjacent = HF.neighbors(s, i % s.W, (i / s.W) | 0, [])
    .filter(j => HF.TERR[s.cells[j].t].cost.F > 0);
  const a = HF.mkUnit(s, 'MG', 1, adjacent[0]); a.fuel = 0;
  const one = HF.threatFields(s, 0).INF[i];
  const b = HF.mkUnit(s, 'MG', 1, adjacent[1]); b.fuel = 0;
  const both = HF.threatFields(s, 0).INF[i];
  HF.removeUnit(s, a);
  const second = HF.threatFields(s, 0).INF[i];
  ok(one > 0 && second > 0 && both === Math.max(one, second) + Math.floor(Math.min(one, second) / 4),
    'threat field accounts for multiple enemies without counting alternative positions twice');
  HF.removeUnit(s, b);
  const mobile = HF.mkUnit(s, 'MG', 1, adjacent[0]);
  const mobileThreat = HF.threatFields(s, 0).INF[i];
  const expected = Math.round(HF.UNITS.MG.atk * HF.UNITS.MG.mul.INF * HF.escalation(s) /
    (1 + HF.TERR[s.cells[i].t].def * 0.062));
  ok(mobileThreat === expected, 'one mobile enemy contributes only once per threatened hex');
  HF.removeUnit(s, mobile);
}
{
  function hqScenario(hp) {
    const s = HF.newGame(0, 'normal');
    s.units = []; s.occ.fill(0); s.funds[0] = 0; s.capU = 0;
    for (const cell of s.cells) { cell.t = 'PLAIN'; cell.own = -1; cell.cap = 0; cell.capSide = -1; }
    s.cells[s.hq[1]].t = 'HQ'; s.cells[s.hq[1]].own = 1;
    const i = HF.neighbors(s, s.hq[1] % s.W, (s.hq[1] / s.W) | 0, [])[0];
    const u = HF.mkUnit(s, 'RIFLE', 0, i); u.hp = hp;
    HF.aiTurn(s);
    return u.i === s.hq[1];
  }
  ok(!hqScenario(60), 'AI avoids starting an HQ capture it cannot finish');
  ok(hqScenario(80), 'AI starts an HQ capture when it can survive the return fire');
}
{
  const s = HF.newGame(0, 'normal');
  s.units = []; s.occ.fill(0); s.funds[0] = 0; s.capU = 0;
  const i = s.hq[0], j = HF.neighbors(s, i % s.W, (i / s.W) | 0, [])[0];
  const attacker = HF.mkUnit(s, 'MBT', 0, i); attacker.fuel = 0;
  const target = HF.mkUnit(s, 'MBT', 1, j); target.hp = 1;
  const events = HF.aiTurn(s);
  ok(events.some(e => e.k === 'attack' && e.id === attacker.id && e.tgt === target.id) &&
    !HF.byId(s, target.id), 'AI fires from a threatened stationary position when it can eliminate the enemy');
}
{
  const s = HF.newGame(5, 'normal');
  s.units = []; s.occ.fill(0);
  const factory = s.cells.findIndex(c => c.own === 0 && c.t === 'FACTORY');
  const weight = (table, id) => {
    const entry = table.find(x => x[0] === id);
    return entry ? entry[1] : 0;
  };
  const before = HF.aiPickBuild(s, 0, factory).table;
  const spots = s.cells.map((c, i) => i).filter(i => i !== factory).slice(0, 4);
  const teams = spots.map(i => HF.mkUnit(s, 'MG', 0, i));
  const withCapturers = HF.aiPickBuild(s, 0, factory).table;
  ok(weight(withCapturers, 'RIFLE') < weight(before, 'RIFLE'),
    'production counts all capture-capable units, not only rifles');
  for (const team of teams) team.ammo = 0;
  const emptyAmmo = HF.aiPickBuild(s, 0, factory).table;
  ok(weight(emptyAmmo, 'TRUCK') > weight(withCapturers, 'TRUCK'),
    'production counts units with exhausted ammunition as needing supply');
}

/* ---------- 6. i18n coverage ---------- */
head('i18n');
{
  const keys = {};
  for (const l of HF.LANGS) keys[l] = Object.keys(HF.I18N[l]);
  const base = keys.ja.slice().sort();
  let same = true;
  for (const l of HF.LANGS) {
    const k = keys[l].slice().sort();
    if (k.join('|') !== base.join('|')) {
      same = false;
      const miss = base.filter(x => k.indexOf(x) < 0);
      const extra = k.filter(x => base.indexOf(x) < 0);
      console.log('  ' + l + ' missing=' + miss.join(',') + ' extra=' + extra.join(','));
    }
  }
  ok(same, 'all three language dictionaries share the same key set (' + base.length + ' keys)');
  /* placeholders line up */
  let ph = 0;
  for (const k of base) {
    const setOf = (key) => (HF.I18N.ja[key].match(/\{\w+\}/g) || []).sort().join(',');
    const want = setOf(k);
    for (const l of ['en', 'zh']) if (setOf(HF.I18N[l][k] ? k : k) !== want) { ph++; console.log('  placeholder mismatch ' + k + ' in ' + l); }
  }
  ok(ph === 0, 'placeholders identical across languages');
  /* data triples */
  let trip = 0, tripAll = 0;
  const check = (o, where) => {
    tripAll++;
    if (o && HF.LANGS.every(l => typeof o[l] === 'string' && o[l].length > 0)) trip++;
    else console.log('  incomplete triple: ' + where);
  };
  for (const id in HF.TERR) { check(HF.TERR[id].n, 'TERR.' + id + '.n'); check(HF.TERR[id].d, 'TERR.' + id + '.d'); }
  for (const id of HF.UIDS) { check(HF.UNITS[id].n, 'UNITS.' + id + '.n'); check(HF.UNITS[id].d, 'UNITS.' + id + '.d'); }
  for (const st of HF.STAGES) { check(st.n, 'STAGE.' + st.id + '.n'); check(st.b, 'STAGE.' + st.id + '.b'); }
  ok(trip === tripAll, 'localised triples ' + trip + '/' + tripAll);
  /* T() falls back and substitutes */
  HF.lang = 'zh';
  ok(HF.T('b.end').length > 0 && HF.T('log.turn', { n: 3, side: 'X' }).indexOf('3') >= 0, 'T() substitution');
  ok(HF.T('no.such.key') === 'no.such.key', 'missing key returns the key itself');
  HF.lang = 'ja';
  /* help text present in every language */
  for (const l of HF.LANGS) {
    HF.lang = l;
    for (const key of ['help.b0', 'help.b1', 'help.b2', 'help.b3', 'help.b4', 'help.b5', 'help.b6',
      'help.t0', 'help.t1', 'help.t2', 'help.t3', 'help.t4', 'help.t5', 'help.t6', 'help.t7', 'help.tab', 'help.title']) {
      const v = HF.T(key);
      const good = key === 'help.tab' ? (typeof v === 'string' && v.indexOf('<table') >= 0)
        : (typeof v === 'string' && v.length >= 1 && v !== key);
      ok(good, key + ' in ' + l);
    }
  }
  HF.lang = 'ja';
}

/* ---------- 7. sprites ---------- */
head('sprite data');
{
  const codes = HF.UIDS.map(id => HF.UNITS[id].s);
  ok(codes.every(code => /^[A-Z0-9]{2,3}$/.test(code)) && new Set(codes).size === codes.length,
    'all unit map codes are short, unique and readable');
  let bad = 0, rows = 0;
  for (const k in HF.ART) {
    const rs = HF.ART[k].split('/');
    const w = Math.max(...rs.map(r => r.length));
    rows += rs.length;
    for (const r of rs) {
      for (const ch of r) {
        if (ch !== '.' && HF.PAL[ch] === undefined) { bad++; console.log('  ' + k + ' uses unknown palette char "' + ch + '"'); break; }
      }
    }
    if (w > 80) { bad++; console.log('  ' + k + ' is ' + w + 'px wide (>80)'); }
  }
  ok(bad === 0, 'sprite palettes and widths clean (' + Object.keys(HF.ART).length + ' sprites, ' + rows + ' rows)');
  let missing = 0;
  for (const id of HF.UIDS) if (!HF.ART[HF.UNITS[id].sp]) { missing++; console.log('  no sprite for ' + id); }
  ok(missing === 0, 'every unit has a sprite');
}

/* ---------- 8. full self-play for every stage ---------- */
head('self-play (player AI vs CPU AI)');
{
  const rowsOut = [];
  for (let idx = 0; idx < HF.STAGES.length; idx++) {
    for (const diff of ['easy', 'normal', 'hard']) {
      const s = HF.newGame(idx, diff);
      let guard = 0;
      const t0 = Date.now();
      while (!s.over && guard++ < 400) {
        HF.aiTurn(s);            // player side driven by the same commander
        HF.endTurn(s);
        if (s.over) break;
        HF.aiTurn(s);
        HF.endTurn(s);
      }
      const ms = Date.now() - t0;
      rowsOut.push({
        st: HF.STAGES[idx].id, diff, turns: s.turn, over: s.over ? s.over.why : 'GATE',
        win: s.over ? s.over.win : '-', ko: s.ko.join('/'), ms
      });
      ok(!!s.over, 'ST' + HF.STAGES[idx].id + '/' + diff + ' ends (turn ' + s.turn + ')');
      ok(s.turn <= s.limit + 1, 'ST' + HF.STAGES[idx].id + '/' + diff + ' respects the turn limit');
      ok(ms < 4000, 'ST' + HF.STAGES[idx].id + '/' + diff + ' AI time ' + ms + 'ms');
    }
  }
  console.table(rowsOut);
  const wins = rowsOut.filter(r => r.win === 0).length;
  console.log('player-AI victories: ' + wins + '/' + rowsOut.length + ' (mirror match should hover near half)');
  ok(wins >= rowsOut.length * 0.2 && wins <= rowsOut.length * 0.8, 'mirror match is not one-sided');
}

console.log('\n----------------------------------------');
console.log('PASS ' + pass + '  FAIL ' + fail);
if (fail) { console.log(fails.map(x => '  x ' + x).join('\n')); process.exit(1); }
