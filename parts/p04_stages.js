/* ===== HEXFRONT :: operations (stages) + map generator — DOM-free ===== */
/* Every stage is deterministic: same seed -> same map, so a stage is a designed
   battle you can retry. Maps grow from 15x9 to 37x16.                       */

HF.STAGES = [
  { id: 1, sz: [15, 9], seed: 1207, theme: 'plain', tiers: 1, funds: 30, cap: 6, limit: 20,
    n: { ja: '初接触', en: 'First Contact', zh: '初次接触' },
    b: { ja: '開けた平野の小競り合い。都市を占領し歩兵を量産せよ', en: 'Open plain skirmish. Take the town, churn out rifles.', zh: '开阔平原小接触，夺城并量产步兵' },
    props: { city: 2, farm: 2, air: 0, depot: 1 }, ownPairs: 1,
    start: ['RIFLE', 'RIFLE', 'RIFLE', 'MG', 'APC'] },

  { id: 2, sz: [17, 10], seed: 8842, theme: 'river', tiers: 2, funds: 45, cap: 8, limit: 22,
    n: { ja: '河の渡河点', en: 'River Crossing', zh: '渡河点' },
    b: { ja: '河が戦線を分断。橋か徒渉を確保しろ', en: 'A river splits the field. Hold the bridges or wade.', zh: '河流分割战线，控制桥梁或徒涉' },
    props: { city: 3, farm: 2, air: 0, depot: 1 }, ownPairs: 1,
    start: ['RIFLE', 'RIFLE', 'RIFLE', 'MG', 'ATGM', 'APC', 'TRUCK'] },

  { id: 3, sz: [19, 10], seed: 4419, theme: 'forest', tiers: 2, funds: 60, cap: 10, limit: 25,
    n: { ja: '森の待ち伏せ', en: 'Forest Ambush', zh: '森林伏击' },
    b: { ja: '森が多く防御側が有利。工兵で補給基地を作れ', en: 'Many forests favour the defender. Engineers build depots.', zh: '森林利于防守，工兵建补给站' },
    props: { city: 3, farm: 3, air: 0, depot: 1 }, ownPairs: 1,
    start: ['RIFLE', 'RIFLE', 'RIFLE', 'MG', 'ATGM', 'ENG', 'APC', 'TRUCK'] },

  { id: 4, sz: [21, 11], seed: 1731, theme: 'mountain', tiers: 3, funds: 80, cap: 12, limit: 28,
    n: { ja: '山岳の峠道', en: 'Mountain Pass', zh: '山岳隘口' },
    b: { ja: '山が車両を分断する。峠を抜けて自走砲を前に', en: 'Ridges split the armour. Break the pass, push SP guns.', zh: '山地分隔车辆，打通隘口推进自行火炮' },
    props: { city: 3, farm: 3, air: 0, depot: 2 }, ownPairs: 1,
    start: ['RIFLE', 'RIFLE', 'RIFLE', 'RIFLE', 'MG', 'ATGM', 'ENG', 'APC', 'TRUCK', 'IFV'] },

  { id: 5, sz: [23, 11], seed: 6604, theme: 'desert', tiers: 4, funds: 100, cap: 14, limit: 30,
    n: { ja: '砂漠の補給路', en: 'Desert Convoy Route', zh: '沙漠补给线' },
    b: { ja: '道が速い。戦車と高射砲を道沿いに走らせろ', en: 'Roads are fast. Run tanks and AAA along them.', zh: '公路高速，沿路投入坦克与高炮' },
    props: { city: 4, farm: 2, air: 0, depot: 2 }, ownPairs: 2,
    start: ['RIFLE', 'RIFLE', 'RIFLE', 'RIFLE', 'MG', 'ATGM', 'ENG', 'APC', 'TRUCK', 'IFV', 'MBT', 'SPART'] },

  { id: 6, sz: [25, 12], seed: 3358, theme: 'coast', tiers: 5, funds: 120, cap: 16, limit: 32,
    n: { ja: '海岸の飛行場', en: 'Coastal Airfield', zh: '海岸机场' },
    b: { ja: '湖と入江。飛行場を占領すれば航空機が使える', en: 'Lakes and inlets. Take the airfield to fly.', zh: '湖泊与海湾，夺机场用飞机' },
    props: { city: 4, farm: 3, air: 2, depot: 2 }, ownPairs: 2,
    start: ['RIFLE', 'RIFLE', 'RIFLE', 'RIFLE', 'MG', 'ATGM', 'ENG', 'APC', 'TRUCK', 'IFV', 'MBT', 'SPART', 'AAA', 'SAM'] },

  { id: 7, sz: [27, 12], seed: 9902, theme: 'woodriver', tiers: 5, funds: 145, cap: 18, limit: 34,
    n: { ja: '二つの河', en: 'Twin Rivers', zh: '两条河流' },
    b: { ja: '二条の河と森。渡河の度に対戦車ミサイルが効く', en: 'Two rivers, woods on the far bank. ATGM rules the bridges.', zh: '两条河与森林，桥头反坦克导弹称王' },
    props: { city: 5, farm: 3, air: 1, depot: 2 }, ownPairs: 2,
    start: ['RIFLE', 'RIFLE', 'RIFLE', 'RIFLE', 'MG', 'MG', 'ATGM', 'ATGM', 'ENG', 'APC', 'TRUCK', 'IFV', 'SPART', 'MBT', 'MBT', 'AAA', 'SAM'] },

  { id: 8, sz: [29, 13], seed: 2276, theme: 'urban', tiers: 6, funds: 170, cap: 19, limit: 36,
    n: { ja: '市街地攻防', en: 'Urban Assault', zh: '城市攻防' },
    b: { ja: '都市が多い市街戦。歩兵で家々を占領せよ', en: 'City sprawl: infantry take house by house.', zh: '城市密集巷战，步兵逐屋占领' },
    props: { city: 6, farm: 3, air: 1, depot: 2 }, ownPairs: 2,
    start: ['RIFLE', 'RIFLE', 'RIFLE', 'RIFLE', 'RIFLE', 'MG', 'MG', 'ATGM', 'ATGM', 'ENG', 'APC', 'APC', 'TRUCK', 'IFV', 'SPART', 'MBT', 'MBT', 'AAA'] },

  { id: 9, sz: [31, 13], seed: 5527, theme: 'delta', tiers: 6, funds: 200, cap: 20, limit: 38,
    n: { ja: '三角洲の防衛線', en: 'Delta Defence Line', zh: '三角洲防线' },
    b: { ja: '入り組んだ水網。ヘリと无人机で機動せよ', en: 'Broken waterways. Lift with helicopters and drones.', zh: '水网复杂，用直升机与无人机机动' },
    props: { city: 6, farm: 4, air: 2, depot: 3 }, ownPairs: 3,
    start: ['RIFLE', 'RIFLE', 'RIFLE', 'RIFLE', 'MG', 'ATGM', 'ATGM', 'ENG', 'APC', 'APC', 'TRUCK', 'IFV', 'SPART', 'MBT', 'MBT', 'AAA', 'SAM', 'AH'] },

  { id: 10, sz: [33, 14], seed: 7188, theme: 'desert', tiers: 7, funds: 230, cap: 21, limit: 42,
    n: { ja: '砂漠の激突', en: 'Desert Clash', zh: '沙漠会战' },
    b: { ja: '開いた砂漠。戦闘機が制空権を握る', en: 'Wide open sand. Fighters decide who owns the sky.', zh: '辽阔沙漠，战斗机决定制空权' },
    props: { city: 6, farm: 4, air: 3, depot: 3 }, ownPairs: 3,
    start: ['RIFLE', 'RIFLE', 'RIFLE', 'RIFLE', 'MG', 'ATGM', 'ATGM', 'ENG', 'APC', 'TRUCK', 'TRUCK', 'IFV', 'IFV', 'SPART', 'MBT', 'MBT', 'AAA', 'SAM', 'MLRS', 'FT'] },

  { id: 11, sz: [35, 15], seed: 3019, theme: 'mountain', tiers: 7, funds: 260, cap: 22, limit: 46,
    n: { ja: '山岳要塞', en: 'Mountain Fortress', zh: '山地要塞' },
    b: { ja: '山塊に築かれた要塞。歩兵と砲で削れ', en: 'Fortress of rock. Grind it with infantry and artillery.', zh: '山地筑垒，以步兵与炮火消耗' },
    props: { city: 7, farm: 4, air: 2, depot: 3 }, ownPairs: 3,
    start: ['RIFLE', 'RIFLE', 'RIFLE', 'RIFLE', 'RIFLE', 'MG', 'MG', 'ATGM', 'ATGM', 'ENG', 'ENG', 'APC', 'TRUCK', 'TRUCK', 'IFV', 'SPART', 'SPART', 'MBT', 'MBT', 'AAA', 'SAM', 'AH'] },

  { id: 12, sz: [37, 16], seed: 1111, theme: 'final', tiers: 8, funds: 300, cap: 24, limit: 52,
    n: { ja: '最終攻勢', en: 'Final Offensive', zh: '最终攻势' },
    b: { ja: '全戦域の決戦。陸と空の全兵器で本営を捉えろ', en: 'The decisive battle: every system, land and air, for the HQ.', zh: '全域决战，陆空全部兵器直取本部' },
    props: { city: 8, farm: 5, air: 3, depot: 3 }, ownPairs: 3,
    start: ['RIFLE', 'RIFLE', 'RIFLE', 'RIFLE', 'MG', 'MG', 'ATGM', 'ATGM', 'ATGM', 'ENG', 'ENG', 'APC', 'APC', 'TRUCK', 'TRUCK', 'IFV', 'SPART', 'MBT', 'MBT', 'AAA', 'SAM', 'MLRS', 'AH', 'BJ'] }
];

HF.stage = function (i) { return HF.STAGES[i]; };
HF.diffMods = {
  easy: { funds: 0.65, inc: 0.8, blunder: 0.28, aggro: 0.85 },
  normal: { funds: 1.0, inc: 1.0, blunder: 0.10, aggro: 1.0 },
  hard: { funds: 1.3, inc: 1.2, blunder: 0.0, aggro: 1.15 }
};

/* ---------- map generation (180-degree symmetric) ---------- */
HF.twinIdx = function (s, i) {
  var c = i % s.W, r = (i / s.W) | 0;
  return (s.H - 1 - r) * s.W + (s.W - 1 - c);
};

function terrSet(s, i, t) { s.cells[i].t = t; }
function setSym(s, i, t) { terrSet(s, i, t); var j = HF.twinIdx(s, i); if (j !== i) terrSet(s, j, t); }

function passable(s, i, doms) {
  var T = HF.TERR[s.cells[i].t];
  for (var k = 0; k < doms.length; k++) if (T.cost[doms[k]] > 0) return true;
  return false;
}

/* BFS land path check between two hexes for the given domain list */
function landLink(s, a, b, doms) {
  var seen = new Uint8Array(s.cells.length), q = [a], head = 0;
  seen[a] = 1;
  var nb = [];
  while (head < q.length) {
    var i = q[head++];
    if (i === b) return true;
    HF.neighbors(s, i % s.W, (i / s.W) | 0, nb);
    for (var k = 0; k < nb.length; k++) {
      var j = nb[k];
      if (seen[j]) continue;
      if (!passable(s, j, doms)) continue;
      seen[j] = 1; q.push(j);
    }
  }
  return false;
}

/* carve a road corridor between two hexes (used as a safety valve) */
function carveLink(s, a, b) {
  var W = s.W, prev = new Int32Array(s.cells.length).fill(-1), q = [a], head = 0;
  prev[a] = a;
  var nb = [];
  while (head < q.length) {
    var i = q[head++];
    if (i === b) break;
    HF.neighbors(s, i % W, (i / W) | 0, nb);
    for (var k = 0; k < nb.length; k++) {
      var j = nb[k];
      if (prev[j] !== -1) continue;
      prev[j] = i; q.push(j);
    }
  }
  if (prev[b] === -1) return;
  var cur = b;
  while (cur !== a) {
    if (HF.TERR[s.cells[cur].t].cost.T < 0) setSym(s, cur, 'BRIDGE');
    else if (s.cells[cur].t !== 'HQ' && s.cells[cur].t !== 'FACTORY' && s.cells[cur].t !== 'AIRFIELD' &&
             s.cells[cur].t !== 'CITY' && s.cells[cur].t !== 'DEPOT' && s.cells[cur].t !== 'FARM') setSym(s, cur, 'ROAD');
    cur = prev[cur];
  }
}

function stampBlob(s, c0, r0, rad, t, rng, skipProp) {
  var list = HF.hexesWithin(s, c0, r0, rad, []);
  for (var k = 0; k < list.length; k++) {
    var i = list[k], cell = s.cells[i];
    if (cell.prop) continue;
    if (cell.t === 'HQ' || cell.t === 'FACTORY' || cell.t === 'AIRFIELD' || cell.t === 'CITY' ||
        cell.t === 'DEPOT' || cell.t === 'FARM' || cell.t === 'BRIDGE' || cell.t === 'ROAD') continue;
    if (rng.chance(0.15 + 0.25 * rad)) continue;
    setSym(s, i, t);
  }
}

HF.genMap = function (stg) {
  var W = stg.sz[0], H = stg.sz[1];
  var s = { W: W, H: H, cells: [], theme: stg.theme, seed: stg.seed };
  function blank() {
    s.cells.length = 0;
    for (var i = 0; i < W * H; i++) s.cells.push({ t: 'PLAIN', own: -1, cap: 0, capSide: -1, prop: 0 });
  }

  var weights = {
    plain: [['FOREST', 2], ['HILL', 3], ['MOUNTAIN', 1]],
    river: [['FOREST', 3], ['HILL', 3], ['MOUNTAIN', 1]],
    woodriver: [['FOREST', 6], ['HILL', 3], ['MOUNTAIN', 2]],
    forest: [['FOREST', 7], ['HILL', 3], ['MOUNTAIN', 1]],
    mountain: [['HILL', 6], ['MOUNTAIN', 6], ['FOREST', 2]],
    desert: [['HILL', 3], ['MOUNTAIN', 3], ['FOREST', 1]],
    coast: [['FOREST', 3], ['HILL', 2], ['LAKE', 6]],
    delta: [['RIVER', 4], ['LAKE', 5], ['FOREST', 2]],
    urban: [['FOREST', 2], ['HILL', 2], ['MOUNTAIN', 1]],
    final: [['FOREST', 3], ['HILL', 4], ['MOUNTAIN', 4], ['LAKE', 2]]
  }[stg.theme] || [['FOREST', 2], ['HILL', 2]];

  var tries = 0;
  while (true) {
    tries++;
    var rng = HF.rng(stg.seed + tries * 7919);
    blank();

    /* terrain blobs in the player's half, mirrored automatically */
    var blobs = Math.round((W * H) / 34) + 4;
    for (var b = 0; b < blobs; b++) {
      var tot = 0, k2;
      for (k2 = 0; k2 < weights.length; k2++) tot += weights[k2][1];
      var pick = rng.range(1, tot), acc = 0, tname = weights[0][0];
      for (k2 = 0; k2 < weights.length; k2++) { acc += weights[k2][1]; if (pick <= acc) { tname = weights[k2][0]; break; } }
      var c0 = rng.range(1, Math.floor(W / 2) - 1), r0 = rng.range(1, H - 2);
      stampBlob(s, c0, r0, rng.chance(0.55) ? 1 : 2, tname, rng);
    }

    /* rivers (vertical, rotationally symmetric wobble) */
    var rivers = [];
    if (stg.theme === 'river' || stg.theme === 'woodriver' || stg.theme === 'final') rivers.push(1);
    if (stg.theme === 'woodriver') rivers.push(2);
    if (stg.theme === 'delta') rivers.push(1, 2);
    var riverCells = [];
    for (var rv = 0; rv < rivers.length; rv++) {
      var cx = rivers.length === 1 ? (W >> 1) : Math.round(W * (rivers[rv] === 1 ? 0.34 : 0.66));
      var wob = [], half = Math.ceil(H / 2);
      for (var r = 0; r < half; r++) wob.push(rng.range(-1, 1));
      for (r = 0; r < H; r++) {
        var wr = r < half ? wob[r] : wob[H - 1 - r];
        var cc = HF.clamp(cx + wr, 1, W - 2);
        var idx = r * W + cc;
        if (!s.cells[idx].prop) { setSym(s, idx, 'RIVER'); riverCells.push(idx); }
      }
    }

    /* lakes for coastal / delta fields */
    if (stg.theme === 'coast' || stg.theme === 'delta' || stg.theme === 'final') {
      var lk = 2 + ((W * H) / 400 | 0);
      for (var q2 = 0; q2 < lk; q2++) {
        var lc = rng.range(2, W - 3), lr = rng.chance(0.5) ? rng.range(0, 1) : rng.range(H - 2, H - 1);
        stampBlob(s, lc, lr, rng.chance(0.4) ? 2 : 1, 'LAKE', rng);
      }
    }

    /* roads: two mirrored rows across the field, bridging rivers */
    var rA = Math.floor((H - 1) / 2), rB = H - 1 - rA;
    [rA, rB].forEach(function (row) {
      for (var c = 0; c < W; c++) {
        var i2 = row * W + c;
        if (s.cells[i2].prop) continue;
        if (s.cells[i2].t === 'RIVER' || s.cells[i2].t === 'LAKE') setSym(s, i2, 'BRIDGE');
        else if (HF.TERR[s.cells[i2].t].cost.T >= 0) setSym(s, i2, 'ROAD');
      }
    });
    /* extra bridges on other rows so the rivers are not a single choke */
    if (riverCells.length) {
      var bridges = 2 + (stg.theme === 'woodriver' ? 1 : 0);
      for (var bb = 0; bb < bridges; bb++) {
        var brow = rng.range(1, Math.max(1, Math.floor(H / 2) - 1));
        for (var c3 = 0; c3 < W; c3++) {
          var i3 = brow * W + c3;
          if (s.cells[i3].t === 'RIVER') setSym(s, i3, 'BRIDGE');
          var j3 = HF.twinIdx(s, i3);
          if (s.cells[j3].t === 'RIVER') terrSet(s, j3, 'BRIDGE');
        }
      }
    }

    /* properties -------------------------------------------------- */
    function tryProp(t, own0, maxTry, minHQdist) {
      for (var t2 = 0; t2 < maxTry; t2++) {
        var c = rng.range(2, W - 4), r = rng.range(1, H - 2);
        var i = r * W + c;
        if (s.cells[i].prop) continue;
        if (!passable(s, i, ['T'])) continue;
        var cell = s.cells[i];
        if (cell.t === 'RIVER' || cell.t === 'LAKE') continue;
        if (HF.dist(c, r, 2, rA) < minHQdist || HF.dist(c, r, W - 3, rB) < minHQdist) continue;
        var near = 0, nb = HF.neighbors(s, c, r, []);
        for (var k = 0; k < nb.length; k++) if (s.cells[nb[k]].prop) near++;
        if (near > 1) continue;
        var j = HF.twinIdx(s, i);
        if (j === i || s.cells[j].prop) continue;
        cell.t = t; cell.prop = 1;
        cell.own = own0;
        s.cells[j].t = t; s.cells[j].prop = 1; s.cells[j].own = (own0 < 0 ? -1 : 1 - own0);
        return true;
      }
      return false;
    }

    var hqA = rA * W + 2, hqB = rB * W + (W - 3);
    s.cells[hqA].t = 'HQ'; s.cells[hqA].prop = 1; s.cells[hqA].own = 0;
    s.cells[hqB].t = 'HQ'; s.cells[hqB].prop = 1; s.cells[hqB].own = 1;

    /* industry / support right next to each HQ (choose symmetric direction once) */
    var dirs = rng.shuffle([[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]]);
    var placedSup = [];
    for (var d = 0; d < dirs.length && placedSup.length < stg.props.depot + 1 + (stg.props.air ? 1 : 0); d++) {
      var c4 = 2 + dirs[d][0], r4 = rA + dirs[d][1];
      if (!HF.inMap(s, c4, r4)) continue;
      var i4 = r4 * W + c4;
      var j4 = HF.twinIdx(s, i4);
      if (s.cells[i4].prop || s.cells[j4].prop || j4 === i4) continue;
      var kind = placedSup.length === 0 ? 'FACTORY' : (placedSup.length === 1 ? 'DEPOT' : 'AIRFIELD');
      if (kind === 'AIRFIELD' && !stg.props.air) kind = 'DEPOT';
      s.cells[i4].t = kind; s.cells[i4].prop = 1; s.cells[i4].own = 0;
      s.cells[j4].t = kind; s.cells[j4].prop = 1; s.cells[j4].own = 1;
      placedSup.push(kind);
    }

    var ownedPairs = stg.ownPairs || 1;
    for (var pc = 0; pc < stg.props.city; pc++) tryProp('CITY', pc < ownedPairs ? 0 : -1, 90, 3);
    for (var pf = 0; pf < stg.props.farm; pf++) tryProp('FARM', -1, 60, 2);
    /* extra airfields away from the HQ */
    for (var pa = 0; pa < Math.max(0, stg.props.air - 1); pa++) tryProp('AIRFIELD', -1, 60, 4);
    for (var pd = 0; pd < Math.max(0, stg.props.depot - 1); pd++) tryProp('DEPOT', -1, 60, 3);

    /* the enemy must be reachable by tracked vehicles from both HQs */
    var okLink = landLink(s, hqA, hqB, ['T']) && landLink(s, hqB, hqA, ['T']);
    if (!okLink) {
      carveLink(s, hqA, hqB);
      okLink = landLink(s, hqA, hqB, ['T']);
    }
    if (okLink || tries > 30) {
      s.hq = [hqA, hqB];
      s.starts = [];
      for (var side = 0; side < 2; side++) {
        var hq = s.hq[side], ring = HF.hexesWithin(s, hq % W, (hq / W) | 0, 3, []);
        ring.sort(function (a, b) { return HF.distIdx(s, hq, a) - HF.distIdx(s, hq, b); });
        s.starts.push(ring.filter(function (i) { return passable(s, i, ['F', 'T']) && s.cells[i].t !== 'LAKE'; }));
      }
      break;
    }
  }
  return s;
};
