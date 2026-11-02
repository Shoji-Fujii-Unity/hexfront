/* ===== HEXFRONT :: rules engine  EDOM-free ===== */

HF.TKEYS = Object.keys(HF.TERR);
HF.TCODE = {}; HF.TKEYS.forEach(function (k, i) { HF.TCODE[k] = i; });

HF.stateRng = function (state) {
  var f = function () {
    var a = (state.rngState + 0x6D2B79F5) >>> 0;
    state.rngState = a;
    var t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.range = function (lo, hi) { return lo + Math.floor(f() * (hi - lo + 1)); };
  f.chance = function (p) { return f() < p; };
  f.pick = function (arr) { return arr[Math.floor(f() * arr.length)]; };
  return f;
};

HF.newGame = function (stageIdx, diff) {
  var stg = HF.STAGES[stageIdx];
  var dm = HF.diffMods[diff] || HF.diffMods.normal;
  var s = HF.genMap(stg);
  s.stageIdx = stageIdx; s.stage = stg; s.diff = diff; s.dm = dm;
  s.turn = 1; s.side = 0;
  s.funds = [stg.funds, Math.round(stg.funds * dm.funds)];
  s.capU = stg.cap; s.limit = stg.limit;
  s.units = []; s.occ = new Int32Array(s.W * s.H).fill(0); s.nextId = 1;
  s.rngState = (stg.seed ^ 0x5f3a) >>> 0;
  s.over = null; s.log = []; s.escLog = 0;
  s.ko = [0, 0];           /* units destroyed by side0, by side1 */
  s.spent = [0, 0];
  for (var side = 0; side < 2; side++) {
    var pool = s.starts[side].slice();
    var list = stg.start.slice();
    for (var k = 0; k < list.length; k++) {
      var tid = list[k];
      if (HF.UNITS[tid].tier > stg.tiers) continue;
      /* prefer a hex that is not a property, closest first, alternating sides of the HQ */
      var placed = null;
      for (var p = 0; p < pool.length; p++) {
        var i = pool[p];
        if (s.occ[i]) continue;
        if (s.cells[i].prop) continue;
        if (!HF.TERR[s.cells[i].t].cost[HF.UNITS[tid].dom] || HF.TERR[s.cells[i].t].cost[HF.UNITS[tid].dom] < 0) continue;
        placed = i; pool.splice(p, 1); break;
      }
      if (placed === null) {
        for (var p2 = 0; p2 < pool.length; p2++) {
          if (!s.occ[pool[p2]]) { placed = pool[p2]; pool.splice(p2, 1); break; }
        }
      }
      if (placed === null) continue;
      var u = HF.mkUnit(s, tid, side, placed);
      u.acted = 0;
    }
  }
  HF.pushLog(s, 'log.turn', { n: 1, side: HF.T(HF.sideKey(0)) });
  HF.sideStart(s, 0);
  return s;
};
HF.sideKey = function (side) { return side === 0 ? 'you' : 'enemy'; };
HF.mkUnit = function (s, tid, side, i) {
  var D = HF.UNITS[tid];
  var u = {
    id: s.nextId++, t: tid, side: side, i: i, hp: 100,
    fuel: D.fuel * 10, ammo: D.ammo, acted: 0, attacked: 0, car: []
  };
  s.units.push(u); s.occ[i] = u.id;
  return u;
};

HF.unitAt = function (s, i) { var id = s.occ[i]; return id ? HF.byId(s, id) : null; };
HF.byId = function (s, id) {
  for (var k = 0; k < s.units.length; k++) if (s.units[k].id === id) return s.units[k];
  return null;
};
HF.liveUnits = function (s, side) { return s.units.filter(function (u) { return u.side === side; }); };
HF.countUnits = function (s, side) { var n = 0; for (var k = 0; k < s.units.length; k++) if (s.units[k].side === side) n++; return n; };
HF.unitVal = function (u) { return HF.UNITS[u.t].cost * (0.4 + 0.6 * u.hp / 100); };
HF.escalation = function (s) {
  var start = Math.round(s.limit * 0.5);
  if (s.turn <= start) return 1;
  return Math.min(3, 1 + (s.turn - start) * 0.035);
};

HF.pushLog = function (s, key, vars) {
  s.log.push({ k: key, v: vars || {} });
  if (s.log.length > 80) s.log.shift();
};

/* ---------- supply + income at the start of a side's turn ---------- */
HF.incomeOf = function (s, side) {
  var n = 0, sites = 0;
  for (var i = 0; i < s.cells.length; i++) {
    var c = s.cells[i];
    if (c.own !== side) continue;
    var inc = HF.TERR[c.t].inc;
    if (inc > 0) { n += inc; sites++; }
  }
  var mult = side === 1 ? (s.dm ? s.dm.inc : 1) : 1;
  return { n: Math.round(n * mult), sites: sites };
};
HF.supplySources = function (s, side) {
  var set = new Uint8Array(s.cells.length);
  for (var i = 0; i < s.cells.length; i++) {
    if (s.cells[i].own === side && HF.TERR[s.cells[i].t].sup) set[i] = 1;
  }
  return set;
};
HF.sideStart = function (s, side) {
  var inc = HF.incomeOf(s, side);
  s.funds[side] += inc.n;
  if (inc.sites) HF.pushLog(s, 'log.income', { n: inc.n, p: inc.sites });
  var src = HF.supplySources(s, side), nb = [], fed = 0, starve = 0;
  var list = HF.liveUnits(s, side);
  for (var k = 0; k < list.length; k++) {
    var u = list[k], D = HF.UNITS[u.t];
    var ok = src[u.i];
    if (!ok) {
      HF.neighbors(s, u.i % s.W, (u.i / s.W) | 0, nb);
      for (var q = 0; q < nb.length && !ok; q++) {
        if (src[nb[q]]) ok = 1;
        else { var o = HF.unitAt(s, nb[q]); if (o && o.side === side && HF.UNITS[o.t].supply) ok = 1; }
      }
    }
    if (ok) { u.fuel = D.fuel * 10; if (u.ammo >= 0) u.ammo = D.ammo; fed++; }
    else starve++;
    u.acted = 0; u.attacked = 0;
  }
  if (fed) HF.pushLog(s, 'log.supply', { n: fed });
  if (starve) HF.pushLog(s, 'log.starve', { n: starve });
  var e = HF.escalation(s);
  if (e > 1.05) {
    var tier = Math.floor((e - 1) / 0.5);
    if (tier > s.escLog) { s.escLog = tier; HF.pushLog(s, 'log.escalate', { m: e.toFixed(2) }); }
  }
};

/* ---------- movement ---------- */
HF.canStop = function (s, u, i) {
  var D = HF.UNITS[u.t], T = HF.TERR[s.cells[i].t];
  var c = T.cost[D.dom];
  if (c === undefined || c < 0) return false;
  if (s.occ[i]) { var o = HF.unitAt(s, i); if (o && o.id !== u.id) return false; }
  return true;
};
HF.canPass = function (s, u, i) {
  var D = HF.UNITS[u.t], T = HF.TERR[s.cells[i].t];
  var c = T.cost[D.dom];
  if (c === undefined || c < 0) return false;
  var o = HF.unitAt(s, i);
  if (o && o.side !== u.side && o.id !== u.id) return false;   /* enemies block */
  return true;
};
/* Dijkstra from the unit's hex; returns {cost, prev, stop:Set-like Uint8Array} */
HF.reach = function (s, u, maxFuel) {
  var W = s.W, n = s.cells.length;
  var cost = new Int32Array(n).fill(-1);
  var prev = new Int32Array(n).fill(-1);
  var budget = Math.min(u.fuel, HF.UNITS[u.t].mv * 10, maxFuel === undefined ? 1e9 : maxFuel);
  cost[u.i] = 0;
  var frontier = [u.i];
  while (frontier.length) {
    /* simple selection of the cheapest node (maps are small) */
    var bi = 0;
    for (var k = 1; k < frontier.length; k++) if (cost[frontier[k]] < cost[frontier[bi]]) bi = k;
    var cur = frontier.splice(bi, 1)[0];
    var nb = HF.neighbors(s, cur % W, (cur / W) | 0, []);
    for (var q = 0; q < nb.length; q++) {
      var j = nb[q];
      if (!HF.canPass(s, u, j)) continue;
      var c2 = cost[cur] + HF.TERR[s.cells[j].t].cost[HF.UNITS[u.t].dom];
      if (c2 > budget) continue;
      if (cost[j] === -1 || c2 < cost[j]) { cost[j] = c2; prev[j] = cur; frontier.push(j); }
    }
  }
  var stop = new Uint8Array(n);
  for (var i2 = 0; i2 < n; i2++) if (cost[i2] >= 0 && HF.canStop(s, u, i2)) stop[i2] = 1;
  return { cost: cost, prev: prev, stop: stop, budget: budget };
};
HF.pathTo = function (s, r, i) {
  var out = [], cur = i;
  while (cur !== -1 && cur !== undefined) { out.push(cur); cur = r.prev[cur]; }
  return out.reverse();
};
HF.canAct = function (s, u) { return !u.acted && !u.attacked && !s.over && s.side === u.side; };
HF.canFire = function (s, u) { return !u.attacked && !s.over && s.side === u.side; };
HF.mayMove = function (s, u) { return HF.canAct(s, u) && u.fuel >= 10 && HF.UNITS[u.t].mv > 0; };


HF.doMove = function (s, u, toIdx) {
  if (!HF.mayMove(s, u)) return null;
  var r = HF.reach(s, u);
  if (!r.stop[toIdx] || r.cost[toIdx] < 0) return null;
  var path = HF.pathTo(s, r, toIdx);
  var from = u.i;
  s.occ[from] = 0;
  u.i = toIdx; s.occ[toIdx] = u.id;
  u.fuel -= r.cost[toIdx];
  u.acted = 1;
  var ev = { k: 'move', id: u.id, from: from, to: toIdx, path: path, unit: u.t, side: u.side };
  if (path.length > 1) HF.pushLog(s, 'log.move', { u: HF.L(HF.UNITS[u.t].n), c: HF.L(HF.TERR[s.cells[toIdx].t].n) });
  return ev;
};

/* ---------- combat ---------- */
HF.designateBonus = function (s, a, tgt) {
  var best = 1;
  for (var k = 0; k < s.units.length; k++) {
    var d = s.units[k];
    if (d.side !== a.side || d === a) continue;
    var D = HF.UNITS[d.t];
    if (!D.desig) continue;
    if (HF.distIdx(s, d.i, tgt.i) <= D.desig) { best = 1 + 0.18; break; }
  }
  return best;
};
HF.hasAmmo = function (u) { var D = HF.UNITS[u.t]; return D.ammo < 0 || u.ammo > 0; };
HF.targetOk = function (s, a, t) {
  var A = HF.UNITS[a.t];
  if (!(A.mul[HF.UNITS[t.t].cls] > 0)) return false;
  if (A.ammo >= 0 && a.ammo <= 0) return false;
  return true;
};

/* deterministic per-engagement roll: the preview matches the shot exactly */
HF.hash01 = function (x) {
  x = (x >>> 0) ^ 0x9e3779b9;
  x = Math.imul(x, 0x7feb352d); x = (x ^ (x >>> 15)) >>> 0;
  x = Math.imul(x, 0x846ca68b); x = (x ^ (x >>> 16)) >>> 0;
  return x / 4294967296;
};
HF.roll = function (s, a, t, from, salt) {
  var x = (a.id * 2654435761) ^ (t.id * 40503) ^ (from * 97) ^ (s.turn * 131) ^ (salt * 7919) ^ (s.stageIdx * 31);
  return HF.hash01(x >>> 0);
};

HF.forecast = function (s, a, t, fromIdx) {
  var A = HF.UNITS[a.t], B = HF.UNITS[t.t];
  if (t.hp <= 0 || a.hp <= 0) return null;
  var mul = A.mul[B.cls] || 0;
  if (mul <= 0) return null;
  var from = (fromIdx === undefined) ? a.i : fromIdx;
  var d = HF.distIdx(s, from, t.i);
  if (d < A.r0 || d > A.r1) return null;
  if (A.ammo >= 0 && a.ammo <= 0) return null;
  var hpF = 0.55 + 0.45 * (a.hp / 100);
  var defF = 1 + HF.TERR[s.cells[t.i].t].def * 0.062;
  var des = HF.designateBonus(s, a, t);
  var v = 0.94 + HF.roll(s, a, t, from, 1) * 0.12;
  var dmg = Math.max(1, Math.round(A.atk * mul * hpF * des * v * HF.escalation(s) / defF));
  dmg = Math.min(dmg, t.hp);
  /* counter */
  var counter = 0;
  if (!B.ind && dmg < t.hp) {
    var mul2 = B.mul[A.cls] || 0;
    var dd = HF.distIdx(s, t.i, from);
    if (mul2 > 0 && dd >= B.r0 && dd <= B.r1 && !(B.ammo >= 0 && t.ammo <= 0)) {
      var hpF2 = 0.55 + 0.45 * ((t.hp - dmg) / 100);
      var defF2 = 1 + HF.TERR[s.cells[from].t].def * 0.062;
      var v2 = 0.94 + HF.roll(s, t, a, from, 2) * 0.12;
      counter = Math.max(1, Math.round(B.atk * mul2 * hpF2 * v2 * HF.escalation(s) / defF2 * (A.ind ? 1 : 0.9)));
      counter = Math.min(counter, a.hp);
    }
  }
  return { dmg: dmg, counter: counter, desig: des > 1, mul: mul, def: HF.TERR[s.cells[t.i].t].def };
};

HF.doAttack = function (s, a, t, fromIdx) {
  if (!HF.canFire(s, a)) return null;
  var fc = HF.forecast(s, a, t, fromIdx);
  if (!fc) return null;
  var A = HF.UNITS[a.t];
  if (A.ammo >= 0) a.ammo--;
  t.hp -= fc.dmg;
  var ev = {
    k: 'attack', id: a.id, side: a.side, unit: a.t, tgt: t.id, tgtUnit: t.t,
    from: a.i, to: t.i, dmg: fc.dmg, counter: fc.counter, desig: fc.desig
  };
  HF.pushLog(s, 'log.attack', { a: HF.L(A.n), b: HF.L(HF.UNITS[t.t].n), d: fc.dmg });
  if (fc.desig) HF.pushLog(s, 'log.designate', { p: 18 });
  var tgtDead = false;
  if (t.hp <= 0) { tgtDead = true; HF.removeUnit(s, t); s.ko[a.side]++; ev.tgtKo = true; HF.pushLog(s, 'log.ko', { b: HF.L(HF.UNITS[t.t].n) }); }
  else if (fc.counter > 0) {
    a.hp -= fc.counter;
    HF.pushLog(s, 'log.counter', { d: fc.counter });
    if (a.hp <= 0) { HF.removeUnit(s, a); s.ko[t.side]++; ev.atkKo = true; HF.pushLog(s, 'log.ko', { b: HF.L(HF.UNITS[a.t].n) }); }
  }
  a.acted = 1; a.attacked = 1;
  ev.tgtDead = tgtDead;
  return ev;
};

HF.removeUnit = function (s, u) {
  if (s.occ[u.i] === u.id) s.occ[u.i] = 0;
  var k = s.units.indexOf(u);
  if (k >= 0) s.units.splice(k, 1);
};

/* ---------- capture / production / support actions ---------- */
HF.endTurn = function (s) {
  var side = s.side;
  var evs = [];
  var nb = [];
  /* capture progress for units that stayed put */
  for (var k = 0; k < s.units.length; k++) {
    var u = s.units[k];
    if (u.side !== side) continue;
    var D = HF.UNITS[u.t], cell = s.cells[u.i];
    if (!D.cap || !HF.TERR[cell.t].cap || cell.own === side) continue;
    if (u.hp < 40) continue;
    if (cell.capSide !== side) { cell.capSide = side; cell.cap = 0; }
    cell.cap++;
    var need = HF.TERR[cell.t].cap;
    if (cell.cap >= need) {
      cell.own = side; cell.cap = 0; cell.capSide = -1;
      HF.pushLog(s, 'log.cap', { p: HF.L(HF.TERR[cell.t].n) });
      evs.push({ k: 'capture', i: u.i, side: side, prop: cell.t });
      if (cell.t === 'HQ') { HF.setOver(s, side, 'hq'); }
    } else {
      HF.pushLog(s, 'log.capp', { p: HF.L(HF.TERR[cell.t].n), n: cell.cap, m: need });
      if (cell.t === 'HQ') {
        var dmg = 20;
        u.hp -= dmg;
        HF.pushLog(s, 'log.hq', { d: dmg });
        evs.push({ k: 'hqfire', i: u.i, dmg: dmg, id: u.id });
        if (u.hp <= 0) { HF.removeUnit(s, u); k--; s.ko[1 - side]++; }
      }
    }
  }
  if (!s.over) {
    /* rout check */
    for (var side2 = 0; side2 < 2; side2++) {
      var other = 1 - side2;
      if (HF.countUnits(s, side2) > 0) continue;
      var prod = 0;
      for (var i = 0; i < s.cells.length; i++) if (s.cells[i].own === side2 && HF.TERR[s.cells[i].t].inc > 0) prod++;
      var cheapest = 999;
      for (var tid in HF.UNITS) if (HF.UNITS[tid].tier <= s.stage.tiers) cheapest = Math.min(cheapest, HF.UNITS[tid].cost);
      if (prod === 0 && s.funds[side2] < cheapest) { HF.setOver(s, other, 'rout'); break; }
    }
  }
  if (!s.over && side === 1 && s.turn >= s.limit) {
    var a = HF.score(s, 0), b = HF.score(s, 1);
    HF.pushLog(s, 'log.timeout', { a: a, b: b });
    HF.setOver(s, a >= b ? 0 : 1, 'limit');
  }
  if (s.over) { evs.push({ k: 'over', win: s.over.win, why: s.over.why }); return evs; }
  s.side = 1 - side;
  if (s.side === 0) s.turn++;
  HF.pushLog(s, 'log.turn', { n: s.turn, side: HF.T(HF.sideKey(s.side)) });
  HF.sideStart(s, s.side);
  evs.push({ k: 'turnend', side: s.side, turn: s.turn });
  return evs;
};

HF.setOver = function (s, win, why) {
  s.over = { win: win, why: why, score: [HF.score(s, 0), HF.score(s, 1)], turns: s.turn };
  HF.pushLog(s, win === 0 ? 'log.win' : 'log.lose', { s: HF.T(HF.sideKey(win)) });
};
HF.score = function (s, side) {
  var v = s.funds[side];
  var list = HF.liveUnits(s, side);
  for (var k = 0; k < list.length; k++) v += HF.unitVal(list[k]) * 1.6;
  for (var i = 0; i < s.cells.length; i++) {
    var c = s.cells[i];
    if (c.own !== side) continue;
    v += HF.TERR[c.t].inc * 6;
    if (c.t === 'HQ') v += 60;
  }
  return Math.round(v);
};

HF.buildable = function (s, cellIdx, side) {
  var cell = s.cells[cellIdx];
  if (cell.own !== side) return null;
  var kind = HF.TERR[cell.t].build;
  if (!kind) return null;
  if (s.occ[cellIdx]) return null;
  var out = [];
  for (var tid in HF.UNITS) {
    var D = HF.UNITS[tid];
    if (D.build !== kind) continue;
    if (D.tier > s.stage.tiers) continue;
    out.push(tid);
  }
  out.sort(function (a, b) { return HF.UNITS[a].cost - HF.UNITS[b].cost; });
  return out;
};
HF.canBuild = function (s, cellIdx, side, tid) {
  var list = HF.buildable(s, cellIdx, side);
  if (!list) return 'block';
  if (list.indexOf(tid) < 0) return 'lock';
  if (HF.countUnits(s, side) >= s.capU) return 'cap';
  if (s.funds[side] < HF.UNITS[tid].cost) return 'funds';
  return true;
};
HF.doBuild = function (s, cellIdx, side, tid) {
  var chk = HF.canBuild(s, cellIdx, side, tid);
  if (chk !== true) return null;
  s.funds[side] -= HF.UNITS[tid].cost; s.spent[side] += HF.UNITS[tid].cost;
  var u = HF.mkUnit(s, tid, side, cellIdx);
  u.acted = 1; u.attacked = 1;       /* new unit cannot act this turn */
  HF.pushLog(s, 'log.build', { u: HF.L(HF.UNITS[tid].n), c: HF.UNITS[tid].cost });
  return { k: 'build', id: u.id, i: cellIdx, unit: tid, side: side };
};

HF.canLoad = function (s, carrier, cargo) {
  var C = HF.UNITS[carrier.t];
  if (!C.car) return false;
  if (carrier.car.length >= C.car) return false;
  if (HF.UNITS[cargo.t].cls !== C.cld) return false;
  if (cargo.side !== carrier.side || carrier.id === cargo.id) return false;
  if (HF.distIdx(s, carrier.i, cargo.i) !== 1) return false;
  if (!HF.canAct(s, cargo)) return false;
  return true;
};
HF.doLoad = function (s, carrier, cargo) {
  if (!HF.canLoad(s, carrier, cargo)) return null;
  HF.removeUnit(s, cargo);
  cargo.acted = 1;
  carrier.car.push(cargo);
  carrier.acted = 1;
  HF.pushLog(s, 'log.load', { a: HF.L(HF.UNITS[cargo.t].n), b: HF.L(HF.UNITS[carrier.t].n) });
  return { k: 'load', id: cargo.id, by: carrier.id };
};
HF.unloadSpots = function (s, carrier, toIdx) {
  var out = [];
  if (!carrier.car.length) return out;
  var r = HF.reach(s, carrier);
  if (!r.stop[toIdx] || r.cost[toIdx] < 0) return out;
  var nb = HF.neighbors(s, toIdx % s.W, (toIdx / s.W) | 0, []);
  for (var k = 0; k < nb.length; k++) {
    var j = nb[k];
    if (s.occ[j]) continue;
    var ok = carrier.car.some(function (c) {
      var cst = HF.TERR[s.cells[j].t].cost[HF.UNITS[c.t].dom];
      return cst > 0;
    });
    if (ok) out.push(j);
  }
  return out;
};
HF.doUnload = function (s, carrier, toIdx) {
  if (!carrier.car.length || !HF.canAct(s, carrier)) return null;
  var r = HF.reach(s, carrier);
  if (!r.stop[toIdx] || r.cost[toIdx] < 0) return null;
  var spots = HF.unloadSpots(s, carrier, toIdx);
  if (!spots.length) return null;
  var from = carrier.i;
  var cargo = carrier.car.shift();
  var best = spots[0];
  var hq = s.hq[1 - carrier.side];
  var bd = 1e9;
  for (var k = 0; k < spots.length; k++) {
    var d = HF.distIdx(s, spots[k], hq);
    if (d < bd) { bd = d; best = spots[k]; }
  }
  s.occ[from] = 0;
  carrier.i = toIdx; s.occ[toIdx] = carrier.id;
  carrier.fuel -= r.cost[toIdx];
  carrier.acted = 1;
  cargo.i = best; s.occ[best] = cargo.id; cargo.acted = 1; cargo.attacked = 1;
  s.units.push(cargo);
  HF.pushLog(s, 'log.unload', { p: HF.L(HF.TERR[s.cells[best].t].n) });
  return { k: 'unload', id: carrier.id, from: from, to: toIdx, cargo: cargo.id, at: best };
};

HF.canFort = function (s, u) {
  if (!HF.UNITS[u.t].fort || !HF.canAct(s, u)) return false;
  var cell = s.cells[u.i];
  if (cell.prop) return false;
  if (cell.t === 'FORT') return false;
  if (s.funds[u.side] < HF.FORT_COST) return false;
  return true;
};
HF.doFort = function (s, u) {
  if (!HF.canFort(s, u)) return null;
  s.funds[u.side] -= HF.FORT_COST;
  s.cells[u.i].t = 'FORT';
  u.acted = 1;
  HF.pushLog(s, 'log.fort', {});
  return { k: 'fort', i: u.i, id: u.id };
};
HF.canDepot = function (s, u) {
  if (!HF.UNITS[u.t].depot || !HF.canAct(s, u)) return false;
  var cell = s.cells[u.i];
  if (cell.prop) return false;
  if (s.funds[u.side] < HF.DEPOT_COST) return false;
  return true;
};
HF.doDepot = function (s, u) {
  if (!HF.canDepot(s, u)) return null;
  s.funds[u.side] -= HF.DEPOT_COST;
  s.cells[u.i].t = 'DEPOT'; s.cells[u.i].prop = 1; s.cells[u.i].own = u.side;
  u.acted = 1;
  HF.pushLog(s, 'log.depot', { c: HF.DEPOT_COST });
  return { k: 'depot', i: u.i, id: u.id };
};

/* every enemy unit that could shoot u from somewhere in its own reach (for AI + hints) */
HF.threatAt = function (s, u, i, cache) {
  var best = 0;
  var foes = HF.liveUnits(s, 1 - u.side);
  for (var k = 0; k < foes.length; k++) {
    var f = foes[k];
    var key = f.id;
    var r = cache[key] || (cache[key] = HF.reach(s, f));
    var D = HF.UNITS[f.t];
    for (var d = D.r0; d <= D.r1; d++) {
      var ring = HF.hexesWithin(s, i % s.W, (i / s.W) | 0, d, []).filter(function (x) { return HF.distIdx(s, x, i) === d; });
      for (var q = 0; q < ring.length; q++) {
        var from = ring[q];
        if (from !== f.i && (r.cost[from] < 0 || !r.stop[from])) continue;
        if (!(D.mul[HF.UNITS[u.t].cls] > 0)) continue;
        if (D.ammo >= 0 && f.ammo <= 0) continue;
        var mul = D.mul[HF.UNITS[u.t].cls];
        var est = D.atk * mul * (0.55 + 0.45 * f.hp / 100) * HF.escalation(s) / (1 + HF.TERR[s.cells[i].t].def * 0.062);
        if (est > best) best = est;
        break;
      }
      if (best) break;
    }
  }
  return Math.round(best);
};

/* ---------- save / load (compact, local only) ---------- */
HF.pack = function (s) {
  var t = '', o = [], cp = [], cs = [], pr = [];
  for (var i = 0; i < s.cells.length; i++) {
    t += String.fromCharCode(65 + HF.TCODE[s.cells[i].t]);
    o.push(s.cells[i].own + 1); cp.push(s.cells[i].cap); cs.push(s.cells[i].capSide + 1); pr.push(s.cells[i].prop);
  }
  function pk(u) {
    return [u.id, HF.UIDS.indexOf(u.t), u.side, u.i, u.hp, u.fuel, u.ammo, u.acted ? 1 : 0, u.attacked ? 1 : 0,
      u.car.map(function (c) { return pk(c); })];
  }
  return {
    v: 1, stageIdx: s.stageIdx, diff: s.diff, turn: s.turn, side: s.side,
    funds: s.funds, capU: s.capU, limit: s.limit, rng: s.rngState, over: s.over,
    escLog: s.escLog, ko: s.ko, spent: s.spent, nextId: s.nextId,
    t: t, o: o, cp: cp, cs: cs, pr: pr,
    u: s.units.map(pk),
    log: s.log.slice(-40)
  };
};
HF.unpack = function (p) {
  var stg = HF.STAGES[p.stageIdx];
  var s = HF.genMap(stg);                     /* regenerate the same terrain shell */
  s.stageIdx = p.stageIdx; s.stage = stg; s.diff = p.diff;
  s.dm = HF.diffMods[p.diff] || HF.diffMods.normal;
  s.turn = p.turn; s.side = p.side; s.funds = p.funds.slice(); s.capU = p.capU; s.limit = p.limit;
  s.rngState = p.rng; s.over = p.over || null; s.escLog = p.escLog || 0;
  s.ko = (p.ko || [0, 0]).slice(); s.spent = (p.spent || [0, 0]).slice(); s.nextId = p.nextId;
  s.units = []; s.occ = new Int32Array(s.W * s.H).fill(0); s.log = p.log || [];
  if (p.t.length !== s.cells.length) return null;      /* stage definition changed */
  for (var i = 0; i < s.cells.length; i++) {
    s.cells[i].t = HF.TKEYS[p.t.charCodeAt(i) - 65];
    s.cells[i].own = p.o[i] - 1; s.cells[i].cap = p.cp[i]; s.cells[i].capSide = p.cs[i] - 1;
    s.cells[i].prop = p.pr[i];
  }
  function up(a, topLevel) {
    var u = {
      id: a[0], t: HF.UIDS[a[1]], side: a[2], i: a[3], hp: a[4], fuel: a[5], ammo: a[6],
      acted: a[7], attacked: a[8], car: (a[9] || []).map(function (c) { return up(c, false); })
    };
    if (topLevel) {
      if (u.i >= 0 && u.i < s.occ.length && !s.occ[u.i]) s.occ[u.i] = u.id;
      if (u.i >= 0 && u.i < s.cells.length) s.units.push(u);
    }
    return u;
  }
  p.u.forEach(function (a) { up(a, true); });
  return s;
};
