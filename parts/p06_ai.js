/* ===== HEXFRONT :: enemy commander (AI) — DOM-free ===== */

/* unweighted hex distance to the nearest source hex */
HF.distField = function (s, sources) {
  var n = s.cells.length, d = new Int32Array(n).fill(9999), q = [], head = 0, nb = [];
  for (var k = 0; k < sources.length; k++) { d[sources[k]] = 0; q.push(sources[k]); }
  while (head < q.length) {
    var i = q[head++];
    HF.neighbors(s, i % s.W, (i / s.W) | 0, nb);
    for (var q2 = 0; q2 < nb.length; q2++) {
      var j = nb[q2];
      if (d[j] > d[i] + 1) { d[j] = d[i] + 1; q.push(j); }
    }
  }
  return d;
};
/* terrain movement-cost to the nearest source hex, for one domain */
HF.costField = function (s, dom, sources) {
  var n = s.cells.length, d = new Int32Array(n).fill(-1), q = [];
  for (var k = 0; k < sources.length; k++) {
    var i = sources[k];
    if (HF.TERR[s.cells[i].t].cost[dom] < 0) continue;
    d[i] = 0; q.push(i);
  }
  while (q.length) {
    var bi = 0;
    for (var k2 = 1; k2 < q.length; k2++) if (d[q[k2]] < d[q[bi]]) bi = k2;
    var cur = q.splice(bi, 1)[0];
    var nb = HF.neighbors(s, cur % s.W, (cur / s.W) | 0, []);
    for (var z = 0; z < nb.length; z++) {
      var j2 = nb[z], cst = HF.TERR[s.cells[j2].t].cost[dom];
      if (cst < 0) continue;
      var nd = d[cur] + HF.TERR[s.cells[cur].t].cost[dom];
      if (d[j2] === -1 || nd < d[j2]) { d[j2] = nd; q.push(j2); }
    }
  }
  for (var m = 0; m < n; m++) if (d[m] < 0) d[m] = 4000;
  return d;
};
/* neighbour rings per hex, cached per map size (geometry only) */
var RINGC = {};
HF.rings = function (s) {
  var key = s.W + 'x' + s.H;
  if (RINGC[key]) return RINGC[key];
  var arr = new Array(s.cells.length);
  for (var i = 0; i < s.cells.length; i++) {
    var buckets = [];
    for (var d = 0; d <= 7; d++) buckets.push([]);
    for (var j = 0; j < s.cells.length; j++) {
      var dd = HF.distIdx(s, i, j);
      if (dd <= 6) buckets[dd].push(j);
    }
    arr[i] = buckets;
  }
  RINGC[key] = arr;
  return arr;
};

/* th[cls][hex] = estimated incoming damage if a unit of cls stood there */
HF.threatFields = function (s, side) {
  var th = {}, peak = {};
  for (var c = 0; c < HF.CLASSES.length; c++) {
    th[HF.CLASSES[c]] = new Int32Array(s.cells.length);
    peak[HF.CLASSES[c]] = new Int32Array(s.cells.length);
  }
  var foes = HF.liveUnits(s, 1 - side), esc = HF.escalation(s), RG = HF.rings(s);
  for (var f = 0; f < foes.length; f++) {
    var fo = foes[f], D = HF.UNITS[fo.t];
    if (D.atk <= 0) continue;
    if (D.ammo >= 0 && fo.ammo <= 0) continue;
    var mulCls = [], any = 0;
    for (var c2 = 0; c2 < HF.CLASSES.length; c2++) {
      var m = D.mul[HF.CLASSES[c2]] || 0;
      if (m > 0) { mulCls.push([HF.CLASSES[c2], m]); any = 1; }
    }
    if (!any) continue;
    var covered = new Uint8Array(s.cells.length), r = HF.reach(s, fo);
    for (var h = 0; h < s.cells.length; h++) {
      if (r.cost[h] < 0 || !r.stop[h]) continue;
      var ring = RG[h];
      for (var d = D.r0; d <= D.r1 && d <= 6; d++) {
        var list = ring[d];
        for (var e = 0; e < list.length; e++) {
          var x = list[e];
          if (x !== fo.i) covered[x] = 1;
        }
      }
    }
    for (var x2 = 0; x2 < s.cells.length; x2++) {
      if (!covered[x2]) continue;
      var df = 1 + HF.TERR[s.cells[x2].t].def * 0.062;
      var base = D.atk * (0.55 + 0.45 * fo.hp / 100) * esc / df;
      for (var c4 = 0; c4 < mulCls.length; c4++) {
        var cls = mulCls[c4][0], v = Math.round(base * mulCls[c4][1]);
        th[cls][x2] += v;
        if (v > peak[cls][x2]) peak[cls][x2] = v;
      }
    }
  }
  for (var c5 = 0; c5 < HF.CLASSES.length; c5++) {
    var cls2 = HF.CLASSES[c5];
    for (var x3 = 0; x3 < s.cells.length; x3++)
      th[cls2][x3] = peak[cls2][x3] + Math.floor((th[cls2][x3] - peak[cls2][x3]) / 4);
  }
  return th;
};

/* ---------- what the AI wants to build (weights per candidate) ---------- */
HF.aiPickBuild = function (s, side, cellIdx) {
  var stg = s.stage, mine = HF.liveUnits(s, side), foes = HF.liveUnits(s, 1 - side);
  var list = HF.buildable(s, cellIdx, side);
  if (!list) return null;
  var allowed = {};
  for (var qz = 0; qz < list.length; qz++) allowed[list[qz]] = 1;
  var have = { INF: 0, SOFT: 0, ARM: 0, AIR: 0 }, key = {};
  function kc(t) { return key[t] || 0; }
  for (var k = 0; k < mine.length; k++) { have[HF.UNITS[mine[k].t].cls]++; key[mine[k].t] = (key[mine[k].t] || 0) + 1; }
  var foeArm = 0, foeAir = 0, foeInf = 0, foeAll = 0;
  for (var q = 0; q < foes.length; q++) {
    var C = HF.UNITS[foes[q].t].cls; foeAll++;
    if (C === 'ARM') foeArm++; else if (C === 'AIR') foeAir++; else if (C === 'INF') foeInf++;
  }
  var antitank = kc('ATGM') * 1.4 + kc('MBT') + kc('AH') + kc('SPART') * 0.7 + kc('BJ') + kc('IFV') * 0.6;
  var antiAir = kc('SAM') * 1.6 + kc('AAA') * 1.3 + kc('FT') * 1.4 + kc('MG') * 0.35;
  /* how many capture-capable units do we need? */
  var targets = 0;
  for (var i = 0; i < s.cells.length; i++) {
    var cell = s.cells[i];
    if (!HF.TERR[cell.t].cap || cell.own === side) continue;
    if (HF.distIdx(s, i, s.hq[side]) <= 6) targets++;
  }
  var capturers = 0;
  for (var c = 0; c < mine.length; c++) if (HF.UNITS[mine[c].t].cap) capturers++;
  var needInf = Math.max(0, Math.min(6, targets) - capturers);
  var needy = 0;
  for (var m = 0; m < mine.length; m++) {
    var u = mine[m];
    if (u.fuel < HF.UNITS[u.t].fuel * 3 || (HF.UNITS[u.t].ammo >= 0 && u.ammo <= 1)) needy++;
  }
  var w = [];
  function add(tid, weight) {
    if (!allowed[tid]) return;
    if (!(weight > 0)) return;
    w.push([tid, weight]);
  }
  add('RIFLE', needInf * 22 + 8);
  add('MG', (kc('MG') < 2 ? 8 : 0) + (foeInf > 4 ? 6 : 0));
  add('ATGM', foeArm > antitank ? 26 : 4);
  add('ENG', (kc('ENG') < 2 ? 10 : 0) + (needy > 2 ? 6 : 0));
  add('TRUCK', needy > 3 && kc('TRUCK') < 3 ? 16 : (kc('TRUCK') < 1 ? 5 : 0));
  add('APC', kc('APC') < 2 ? 7 : 0);
  add('IFV', 10);
  add('MBT', foeArm < antitank ? 8 : 18);
  add('SPART', 13);
  add('MLRS', 10);
  add('AAA', foeAir > antiAir * 0.6 ? 18 : 0);
  add('SAM', foeAir > 0 ? (foeAir > antiAir * 0.5 ? 22 : 8) : 0);
  add('CH', kc('CH') < 2 && needy > 2 ? 8 : 0);
  add('UAV', 7);
  add('AH', foeArm > 1 ? 18 : 8);
  add('FT', foeAir >= 1 ? 20 : 0);
  add('BJ', 16);
  if (!w.length) return null;
  var tot = 0;
  for (var t = 0; t < w.length; t++) tot += w[t][1];
  return { table: w, total: tot };
};

/* ---------- one AI turn ---------- */
HF.aiTurn = function (s) {
  var evs = [];
  if (s.over) return evs;
  var side = s.side, dm = s.dm || HF.diffMods.normal, aggro = dm.aggro;
  var rng = HF.stateRng(s);
  var foes = HF.liveUnits(s, 1 - side), mine = HF.liveUnits(s, side);
  var th = HF.threatFields(s, side);
  /* objectives */
  var capProps = [], ownProps = [], ownSup = [], buildCells = [];
  for (var i = 0; i < s.cells.length; i++) {
    var cell = s.cells[i], T = HF.TERR[cell.t];
    if (T.cap && cell.own !== side) capProps.push(i);
    if (T.cap && cell.own === side) ownProps.push(i);
    if (cell.own === side && T.sup) ownSup.push(i);
    if (cell.own === side && T.build) buildCells.push(i);
  }
  var enemyHexes = foes.map(function (u) { return u.i; });
  var fCache = {}, dCache = {};
  function field(dom, kind, src) {
    var key = kind + dom + ':' + src.slice().sort(function (a, b) { return a - b; }).join(',');
    if (!fCache[key]) fCache[key] = (kind === 'cost') ? HF.costField(s, dom, src) : HF.distField(s, src);
    return fCache[key];
  }
  /* capture-defence: hexes of our property that the enemy is contesting */
  var contest = ownProps.filter(function (i) { return s.cells[i].capSide !== side && s.cells[i].capSide >= 0; });
  var nearHq = s.hq[side];
  var order = mine.slice().sort(function (a, b) {
    var A = HF.UNITS[a.t], B = HF.UNITS[b.t];
    return (B.ind ? -1 : 1) - (A.ind ? -1 : 1) || B.cost - A.cost;
  });

  for (var k = 0; k < order.length; k++) {
    var u = HF.byId(s, order[k].id);
    if (!u || u.acted || u.attacked) continue;
    var D = HF.UNITS[u.t], val = D.cost;
    var r = HF.reach(s, u);
    var reachList = [];
    for (var h2 = 0; h2 < s.cells.length; h2++) if (r.cost[h2] >= 0 && r.stop[h2]) reachList.push(h2);
    /* choose the objective field for this unit */
    var needSupply = (u.fuel < D.fuel * 4) || (D.ammo >= 0 && u.ammo <= 1);
    var objField, ideal = 0;
    if (D.ind) { objField = field('A', 'dist', enemyHexes.length ? enemyHexes : capProps); ideal = (D.r0 + D.r1) / 2; }
    else if (D.cap) objField = field(D.dom, 'cost', capProps.length ? capProps : enemyHexes);
    else if (D.supply) objField = field(D.dom, 'cost', ownProps.length ? ownProps : ownSup);
    else if (D.cls === 'AIR') objField = field('A', 'dist', enemyHexes.length ? enemyHexes : capProps);
    else objField = field(D.dom, 'cost', enemyHexes.length ? enemyHexes : capProps);
    var stayCost = objField[u.i];
    var supField = needSupply ? field(D.dom, 'cost', ownSup.length ? ownSup : [nearHq]) : null;
    /* operational pull: heavy formations want the enemy HQ, not just the next farm */
    var foeHqField = null, hqStay = 0, hqPush = 0;
    if (D.cap || D.cls === 'ARM') {
      foeHqField = field(D.dom, 'cost', [s.hq[1 - side]]);
      hqStay = foeHqField[u.i];
      hqPush = (D.cls === 'ARM' || val >= 13) ? 1.35 : 0.55;
    }
    var best = { h: u.i, sc: -Infinity, tgt: null };
    var vuln = [];
    if (!(D.ammo >= 0 && u.ammo <= 0)) {
      for (var e2 = 0; e2 < foes.length; e2++) {
        var fo2 = foes[e2], F0 = HF.UNITS[fo2.t];
        var mm = D.mul[F0.cls] || 0;
        if (mm <= 0 || fo2.hp <= 0 || !HF.byId(s, fo2.id)) continue;
        vuln.push({
          foe: fo2, F: F0, tv: F0.cost
        });
      }
    }

    for (var q = 0; q < reachList.length; q++) {
      var h = reachList[q];
      var sc = 0;
      /* threat incoming on that hex */
      sc -= th[D.cls][h] / 100 * val * (D.ind ? 0.70 : 0.42) / aggro;
      /* progress toward the objective */
      if (D.ind) sc -= Math.abs(objField[h] - ideal) * 7;
      else sc += (stayCost - objField[h]) * 0.9;
      /* drive on the enemy headquarters */
      if (foeHqField) sc += (hqStay - foeHqField[h]) * hqPush;
      /* supply situation */
      if (supField) sc -= supField[h] * 0.25;
      /* capture */
      var cell = s.cells[h], T = HF.TERR[cell.t];
      var capProgress = cell.capSide === side ? cell.cap : 0;
      var hqHp = 40 + 20 * Math.max(0, T.cap - capProgress - 1);
      if (D.cap && cell.t === 'HQ' && cell.own !== side &&
          u.hp >= 40 && u.hp < hqHp) continue;
      if (D.cap && u.hp >= 40 && T.cap && cell.own !== side) {
        var cv = 14 + T.inc * 4 + (T.build ? 22 : 0) + (cell.t === 'HQ' ? 4000 : 0);
        if (cell.capSide === side) cv += 40 + cell.cap * 260;   /* finish what we started */
        sc += cv;
      }
      /* defending a contested own property */
      if (D.cap && cell.own === side && contest.indexOf(h) >= 0) sc += 60;
      /* being deep in the enemy rear is worth something even on open ground */
      if (D.cap && foeHqField && foeHqField[h] < 130) sc += (130 - foeHqField[h]) * 0.08;
      /* attack options from that hex */
      var atkBest = null;
      if (vuln.length) {
        for (var v2 = 0; v2 < vuln.length; v2++) {
          var V = vuln[v2], foe = V.foe;
          if (foe.hp <= 0 || !HF.byId(s, foe.id)) continue;
          var dd = HF.distIdx(s, h, foe.i);
          if (dd < D.r0 || dd > D.r1) continue;
          var fc = HF.forecast(s, u, foe, h);
          if (!fc) continue;
          var s2 = (fc.dmg / 100) * V.tv * 1.25 + (fc.dmg >= foe.hp ? V.tv * 0.55 : 0) -
            (fc.counter / 100) * val * 0.75 - (fc.counter >= u.hp ? val * 0.55 : 0);
          if (V.F.cls === 'AIR') s2 += 4;
          /* clear the guard around the enemy headquarters */
          if (HF.distIdx(s, foe.i, s.hq[1 - side]) <= 2) s2 += 10;
          if (s2 > (atkBest ? atkBest.s2 : -1e9)) atkBest = { foe: foe, s2: s2 };
        }
      }
      if (atkBest) sc += atkBest.s2 * aggro;
      if (sc > best.sc) { best = { h: h, sc: sc, tgt: atkBest ? atkBest.foe : null }; }
    }

    /* blunder chance on easy */
    if (dm.blunder > 0 && rng.chance(dm.blunder) && best.sc < 120) best = { h: u.i, sc: 0, tgt: null };

    var moved = false;
    if (best.h !== u.i) {
      var mv = HF.doMove(s, u, best.h);
      if (mv) { evs.push(mv); moved = true; }
    }
    if (best.tgt && !u.attacked && HF.byId(s, best.tgt.id) && u.hp > 0) {
      if (HF.inRange(s, u, best.tgt, u.i)) {
        var at = HF.doAttack(s, u, best.tgt, u.i);
        if (at) evs.push(at);
      }
    }
    /* engineer support */
    if (u.hp > 0 && D.fort && !u.attacked) {
      var needyNear = false;
      for (var m2 = 0; m2 < mine.length; m2++) {
        var w2 = mine[m2];
        if (w2.id === u.id || !HF.byId(s, w2.id)) continue;
        if (w2.fuel < HF.UNITS[w2.t].fuel * 5 && HF.distIdx(s, u.i, w2.i) <= 4) { needyNear = true; break; }
      }
      if (needyNear && HF.canDepot(s, u) && !s.cells[u.i].prop) evs.push(HF.doDepot(s, u));
      else if (th[D.cls][u.i] > 45 && HF.canFort(s, u)) evs.push(HF.doFort(s, u));
    }
  }

  /* ---------- production ---------- */
  var emptyCells = buildCells.filter(function (i) { return !s.occ[i]; });
  var guard = 0;
  while (emptyCells.length && HF.countUnits(s, side) < s.capU && guard++ < 8) {
    /* factories first (cheaper, land army first), then airfields */
    emptyCells.sort(function (a, b) {
      var ka = HF.TERR[s.cells[a].t].build === 'LAND' ? 0 : 1;
      var kb = HF.TERR[s.cells[b].t].build === 'LAND' ? 0 : 1;
      return ka - kb || a - b;
    });
    var built = false;
    for (var ci = 0; ci < emptyCells.length && !built; ci++) {
      var cell2 = emptyCells[ci];
      if (s.occ[cell2]) continue;
      var pick = HF.aiPickBuild(s, side, cell2);
      if (!pick) continue;
      /* spend in weight order but only on things we can actually afford */
      var table = pick.table.slice().sort(function (a, b) { return b[1] - a[1]; });
      var tid = null;
      for (var t3 = 0; t3 < table.length; t3++) {
        if (HF.UNITS[table[t3][0]].cost <= s.funds[side]) { tid = table[t3][0]; break; }
      }
      if (!tid) continue;
      /* saving up: if the priciest useful system is affordable soon, do not waste money */
      var pricey = HF.UNITS[table[0][0]].cost;
      if (HF.countUnits(s, side) > 0 && HF.UNITS[tid].cost < pricey &&
          s.funds[side] + HF.incomeOf(s, side).n >= pricey && rng.chance(0.55)) continue;
      var ev2 = HF.doBuild(s, cell2, side, tid);
      if (ev2) { evs.push(ev2); built = true; }
    }
    if (!built) break;
    emptyCells = emptyCells.filter(function (i) { return !s.occ[i]; });
  }
  evs.push({ k: 'turnend', side: side });
  return evs;
};
