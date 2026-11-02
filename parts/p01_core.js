/* ===== HEXFRONT :: core (hex math, rng, storage) — DOM-free ===== */
var HF = (typeof globalThis !== 'undefined') ? (globalThis.HF = globalThis.HF || {}) : {};

HF.VER = '1.0.0';
HF.lang = 'ja';
HF.soundOn = true;
HF.musicOn = true;

/* ---------- misc ---------- */
HF.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
HF.idx = function (s, c, r) { return r * s.W + c; };
HF.inMap = function (s, c, r) { return c >= 0 && r >= 0 && c < s.W && r < s.H; };
HF.keyOf = function (s, i) { return [i % s.W, (i / s.W) | 0]; };

/* deterministic RNG (mulberry32) */
HF.rng = function (seed) {
  var a = (seed >>> 0) || 1;
  var f = function () {
    a = (a + 0x6D2B79F5) >>> 0;
    var t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.int = function (n) { return Math.floor(f() * n); };
  f.range = function (lo, hi) { return lo + Math.floor(f() * (hi - lo + 1)); };
  f.pick = function (arr) { return arr[Math.floor(f() * arr.length)]; };
  f.chance = function (p) { return f() < p; };
  f.shuffle = function (arr) {
    for (var i = arr.length - 1; i > 0; i--) { var j = Math.floor(f() * (i + 1)); var t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
    return arr;
  };
  return f;
};

/* ---------- pointy-top hex grid, odd-r offset ---------- */
HF.DIRS = [
  [[1, 0], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1]],    /* even row: E NE NW W SW SE */
  [[1, 0], [1, -1], [0, -1], [-1, 0], [0, 1], [1, 1]]       /* odd  row: E NE NW W SW SE */
];
HF.DIRNAME = ['E', 'NE', 'NW', 'W', 'SW', 'SE'];

HF.neighbors = function (s, c, r, out) {
  out = out || [];
  out.length = 0;
  var d = HF.DIRS[r & 1];
  for (var k = 0; k < 6; k++) {
    var nc = c + d[k][0], nr = r + d[k][1];
    if (nc >= 0 && nr >= 0 && nc < s.W && nr < s.H) out.push(nr * s.W + nc);
  }
  return out;
};

HF.axial = function (c, r) {
  var x = c - ((r - (r & 1)) >> 1);
  return [x, -x - r, r];
};
HF.dist = function (c1, r1, c2, r2) {
  var a = HF.axial(c1, r1), b = HF.axial(c2, r2);
  return (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])) / 2;
};
HF.distIdx = function (s, i, j) {
  return HF.dist(i % s.W, (i / s.W) | 0, j % s.W, (j / s.W) | 0);
};
/* ring of hexes at distance<=rad around c,r (inside map) */
HF.hexesWithin = function (s, c, r, rad, out) {
  out = out || [];
  out.length = 0;
  for (var rr = Math.max(0, r - rad); rr <= Math.min(s.H - 1, r + rad); rr++) {
    for (var cc = Math.max(0, c - rad - 1); cc <= Math.min(s.W - 1, c + rad + 1); cc++) {
      if (HF.dist(cc, rr, c, r) <= rad) out.push(rr * s.W + cc);
    }
  }
  return out;
};

/* pixel centre of a hex (world units, hex "radius" = R) */
HF.hexW = function (R) { return Math.sqrt(3) * R; };
HF.hexCX = function (s, c, r, R) { return HF.hexW(R) * (c + 0.5 * (r & 1)) + HF.hexW(R) / 2; };
HF.hexCY = function (s, r, R) { return R * 1.5 * r + R + 2 * R * 0.0; }

/* inverse: world pixel -> nearest hex */
HF.pxToHex = function (s, x, y, R) {
  var hw = HF.hexW(R);
  var r = Math.round((y - R) / (1.5 * R));
  r = HF.clamp(r, 0, s.H - 1);
  var best = -1, bd = 1e9;
  var cand = [r - 1, r, r + 1];
  for (var k = 0; k < 3; k++) {
    var rr = cand[k];
    if (rr < 0 || rr >= s.H) continue;
    var c0 = Math.round(x / hw - 0.5 * (rr & 1));
    for (var cc = c0 - 1; cc <= c0 + 1; cc++) {
      if (cc < 0 || cc >= s.W) continue;
      var dx = x - HF.hexCX(s, cc, rr, R), dy = y - HF.hexCY(s, rr, R);
      var d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = rr * s.W + cc; }
    }
  }
  return best;
};

/* ---------- storage (local, safe fallback) ---------- */
HF.store = (function () {
  var mem = {}, ok = true;
  function ls() {
    try {
      if (typeof localStorage === 'undefined' || !localStorage) return null;
      var k = '__hf_probe__';
      localStorage.setItem(k, '1'); localStorage.removeItem(k);
      return localStorage;
    } catch (e) { ok = false; return null; }
  }
  return {
    available: function () { return !!ls(); },
    get: function (k) {
      var L = ls(); if (!L) return mem[k] === undefined ? null : mem[k];
      try { return L.getItem(k); } catch (e) { return null; }
    },
    set: function (k, v) {
      var L = ls(); if (!L) { mem[k] = v; return true; }
      try { L.setItem(k, v); return true; } catch (e) { return false; }
    },
    del: function (k) {
      var L = ls(); if (!L) { delete mem[k]; return; }
      try { L.removeItem(k); } catch (e) { }
    },
    ok: function () { return ok; }
  };
})();

HF.SAVE_KEY = 'hexfront.save.v1';
HF.PROFILE_KEY = 'hexfront.profile.v1';

/* profile: settings + progression (persisted even after a game finishes) */
HF.loadProfile = function () {
  var p = null;
  try { p = JSON.parse(HF.store.get(HF.PROFILE_KEY) || 'null'); } catch (e) { p = null; }
  if (!p || p.v !== 1) {
    p = { v: 1, lang: null, sound: 1, music: 1, diff: 'normal', unlocked: 1, best: {}, seen: [], plays: 0 };
  }
  if (p.music === undefined) p.music = p.sound === 0 ? 0 : 1;
  if (!p.best) p.best = {};
  if (!p.seen) p.seen = [];
  if (!p.unlocked) p.unlocked = 1;
  return p;
};
HF.saveProfile = function (p) { return HF.store.set(HF.PROFILE_KEY, JSON.stringify(p)); };

/* in-progress game save */
HF.writeSave = function (rec) { return HF.store.set(HF.SAVE_KEY, JSON.stringify(rec)); };
HF.readSave = function () {
  var raw = HF.store.get(HF.SAVE_KEY);
  if (!raw) return null;
  try { var o = JSON.parse(raw); } catch (e) { return null; }
  if (!o || o.v !== 1 || !o.st) return null;
  return o;
};
HF.clearSave = function () { HF.store.del(HF.SAVE_KEY); };

/* ---------- localised text helper ---------- */
/* L({ja:'',en:'',zh:''}) -> string in current language */
HF.L = function (o) {
  if (!o) return '';
  if (typeof o === 'string') return o;
  var v = o[HF.lang];
  if (v === undefined || v === null || v === '') v = o.en;
  return v === undefined ? '' : v;
};
HF.T = function (key, vars) {
  var d = HF.I18N[HF.lang] || HF.I18N.en;
  var s = (d && d[key] !== undefined) ? d[key] : (HF.I18N.en[key] !== undefined ? HF.I18N.en[key] : key);
  if (vars) s = s.replace(/\{(\w+)\}/g, function (m, k) { return (vars[k] === undefined || vars[k] === null) ? m : String(vars[k]); });
  return s;
};
HF.LANGS = ['ja', 'en', 'zh'];
HF.LANGNAME = { ja: '日本語', en: 'English', zh: '中文' };
HF.pickLang = function (prefer) {
  if (prefer && HF.LANGS.indexOf(prefer) >= 0) return prefer;
  var nav = '';
  try { nav = (typeof navigator !== 'undefined') ? (navigator.language || '') : ''; } catch (e) { }
  nav = (nav || '').toLowerCase();
  if (nav.indexOf('zh') === 0) return 'zh';
  if (nav.indexOf('ja') === 0) return 'ja';
  if (nav.indexOf('en') === 0) return 'en';
  return 'en';
};
