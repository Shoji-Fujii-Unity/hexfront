/* ===== HEXFRONT :: pixel-art rendering (canvas) ===== */
(function () {
  var V = HF.view = { cv: null, ctx: null, cam: { x: 0, y: 0, R: 20 }, dpr: 1, w: 0, h: 0, dirtyTerr: true, popups: [], fx: [], flash: 0, RMIN: 8, RMAX: 44 };

  /* ---------- palette / baking ---------- */
  var cache = {};
  function art(key, side) {
    var ck = key + ':' + side;
    if (cache[ck]) return cache[ck];
    var raw = HF.ART[key];
    if (!raw) return null;
    var rows = raw.split('/'), w = 0, r, c2;
    for (r = 0; r < rows.length; r++) w = Math.max(w, rows[r].length);
    var h = rows.length;
    var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    var cx = cv.getContext('2d');
    var tint = HF.SIDECOL[side] || HF.SIDECOL[0];
    var pal = {
      D: tint.d, M: tint.m, L: tint.l
    };
    for (var k in HF.PAL) pal[k] = (HF.PAL[k] === 'TEAM_D') ? tint.d : (HF.PAL[k] === 'TEAM_M') ? tint.m : (HF.PAL[k] === 'TEAM_L') ? tint.l : HF.PAL[k];
    for (r = 0; r < h; r++) {
      var row = rows[r];
      for (c2 = 0; c2 < row.length; c2++) {
        var ch = row.charAt(c2);
        if (ch === '.' || ch === ' ') continue;
        var col = pal[ch];
        if (!col) continue;
        cx.fillStyle = col;
        cx.fillRect(c2, r, 1, 1);
      }
    }
    cache[ck] = { cv: cv, w: w, h: h };
    return cache[ck];
  }
  HF.bakeArt = art;

  /* ---------- theme colours ---------- */
  var THEME = {
    plain: { p: '#6f8c4c', p2: '#7d9a58', road: '#8d8574', for: '#37562f', hill: '#7a8a55', mnt: '#6c6f6a' },
    river: { p: '#6b8a52', p2: '#7a9a5e', road: '#8d8574', for: '#33512c', hill: '#76864f', mnt: '#6b6e69' },
    woodriver: { p: '#5f7d4a', p2: '#6d8b55', road: '#877f6e', for: '#2c4a26', hill: '#6d7d48', mnt: '#676a66' },
    forest: { p: '#57753f', p2: '#64834a', road: '#847c6b', for: '#28451f', hill: '#647440', mnt: '#626561' },
    mountain: { p: '#7c8365', p2: '#888f70', road: '#8d8676', for: '#3d5630', hill: '#8a8763', mnt: '#7b7d78' },
    desert: { p: '#c2a470', p2: '#d0b47f', road: '#9c8f74', for: '#5f6d38', hill: '#b0925f', mnt: '#96825f' },
    coast: { p: '#8d9a5f', p2: '#9aa76c', road: '#9b9280', for: '#3f5c31', hill: '#8a8f5c', mnt: '#7d7f78' },
    delta: { p: '#5f7f52', p2: '#6c8c5d', road: '#8a8270', for: '#2f4d28', hill: '#6a7c4a', mnt: '#666a63' },
    urban: { p: '#828c6d', p2: '#8e9878', road: '#8f8878', for: '#3c5730', hill: '#7e8360', mnt: '#767a74' },
    final: { p: '#6f7f57', p2: '#7c8c62', road: '#8d8574', for: '#33512b', hill: '#78854f', mnt: '#71736d' }
  };
  var WATER = ['#2c5c86', '#3f76a6', '#63a0c8'];

  function hash(i, k) {
    var x = (i * 2654435761) ^ (k * 40503);
    x = (x ^ (x >>> 15)) >>> 0; x = Math.imul(x, 0x7feb352d);
    x = (x ^ (x >>> 12)) >>> 0;
    return (x % 1000) / 1000;
  }

  function hexPath(cx2, x, y, R) {
    cx2.beginPath();
    for (var i = 0; i < 6; i++) {
      var a = Math.PI / 180 * (60 * i - 30);
      var px = Math.round(x + R * Math.cos(a)), py = Math.round(y + R * Math.sin(a));
      if (i === 0) cx2.moveTo(px, py); else cx2.lineTo(px, py);
    }
    cx2.closePath();
  }
  HF.hexPath = hexPath;

  /* ---------- terrain layer ---------- */
  var terr = null, terrKey = '';
  function buildTerrain(s) {
    var R = V.cam.R, hw = HF.hexW(R);
    var W = Math.ceil(hw * (s.W + 0.5)) + 2, H = Math.ceil(1.5 * R * s.H + 0.5 * R) + 2;
    if (!terr) terr = document.createElement('canvas');
    terr.width = W; terr.height = H;
    var g = terr.getContext('2d');
    g.imageSmoothingEnabled = false;
    var th = THEME[s.theme] || THEME.plain;
    g.fillStyle = th.p; g.fillRect(0, 0, W, H);
    for (var i = 0; i < s.cells.length; i++) {
      var c = i % s.W, r = (i / s.W) | 0;
      var x = Math.round(HF.hexCX(s, c, r, R)), y = Math.round(HF.hexCY(s, r, R));
      var cell = s.cells[i], T = cell.t;
      var base = th.p, alt = th.p2;
      if (T === 'ROAD') { base = th.road; alt = '#a49b88'; }
      else if (T === 'FOREST') { base = th.for; alt = '#4e7038'; }
      else if (T === 'HILL') { base = th.hill; alt = '#9aa06a'; }
      else if (T === 'MOUNTAIN') { base = th.mnt; alt = '#93968f'; }
      else if (T === 'RIVER' || T === 'LAKE') { base = WATER[0]; alt = WATER[1]; }
      else if (T === 'BRIDGE') { base = WATER[0]; alt = '#b99b64'; }
      else if (T === 'CITY') { base = '#737d8c'; alt = '#a4afbd'; }
      else if (T === 'FARM') { base = '#a88e4e'; alt = '#d1bc76'; }
      else if (T === 'FACTORY') { base = '#796d62'; alt = '#b7a18b'; }
      else if (T === 'AIRFIELD') { base = '#647d87'; alt = '#b1c9ca'; }
      else if (T === 'DEPOT') { base = '#80785d'; alt = '#d0bf87'; }
      else if (T === 'HQ') { base = '#596b7c'; alt = '#a9bdcd'; }
      else if (T === 'FORT') { base = '#6b6455'; alt = '#877e68'; }
      hexPath(g, x, y, R);
      g.fillStyle = base; g.fill();
      /* pixel texture */
      g.save(); hexPath(g, x, y, R); g.clip();
      if (T === 'PLAIN') {
        g.fillStyle = alt;
        for (var k = 0; k < 5; k++) {
          var hx = Math.round(x - R + hash(i, k) * 2 * R), hy = Math.round(y - R + hash(i, k + 9) * 2 * R);
          g.fillRect(hx, hy, 2, 1);
        }
        if (hash(i, 77) > 0.72) drawArt(g, 'bump', x, y + 2, 1, 0);
      } else if (T === 'ROAD') {
        g.fillStyle = '#6e6757';
        g.fillRect(x - R, y - 2, 2 * R, 4);
        g.fillStyle = alt;
        for (var k2 = 0; k2 < 3; k2++) g.fillRect(x - R + 3 + k2 * 6, y - 1, 2, 2);
      } else if (T === 'FOREST') {
        var treeScale = HF.clamp(R / 16, 0.6, 2.2);
        drawArt(g, 'tree', x - Math.round(R * 0.32), y + Math.round(R * 0.2), treeScale, 0);
        drawArt(g, 'tree', x + Math.round(R * 0.34), y + Math.round(R * 0.32), treeScale, 0);
        if (R > 12) drawArt(g, 'tree', x + Math.round(R * 0.02), y - Math.round(R * 0.25), treeScale, 0);
      } else if (T === 'HILL') {
        g.strokeStyle = alt; g.lineWidth = Math.max(1, Math.round(R / 14));
        for (var contour = 0; contour < 3; contour++) {
          var dy = Math.round((contour - 1) * R * 0.3);
          g.beginPath(); g.moveTo(x - R * 0.65, y + dy + R * 0.2);
          g.lineTo(x - R * 0.25, y + dy); g.lineTo(x + R * 0.25, y + dy);
          g.lineTo(x + R * 0.65, y + dy + R * 0.2); g.stroke();
        }
      } else if (T === 'MOUNTAIN') {
        g.fillStyle = '#4d5559';
        g.beginPath(); g.moveTo(x - R * 0.8, y + R * 0.55); g.lineTo(x - R * 0.1, y - R * 0.7);
        g.lineTo(x + R * 0.7, y + R * 0.55); g.closePath(); g.fill();
        g.fillStyle = alt;
        g.beginPath(); g.moveTo(x - R * 0.1, y - R * 0.7); g.lineTo(x + R * 0.7, y + R * 0.55);
        g.lineTo(x + R * 0.15, y + R * 0.55); g.closePath(); g.fill();
        g.fillStyle = '#d1d6d2';
        g.beginPath(); g.moveTo(x - R * 0.1, y - R * 0.7); g.lineTo(x + R * 0.18, y - R * 0.25);
        g.lineTo(x - R * 0.1, y - R * 0.36); g.lineTo(x - R * 0.32, y - R * 0.27); g.closePath(); g.fill();
      } else if (T === 'RIVER' || T === 'LAKE') {
        g.fillStyle = alt;
        for (var k3 = 0; k3 < 4; k3++) {
          var wx = Math.round(x - R * 0.7 + hash(i, k3) * R * 1.2), wy = Math.round(y - R * 0.6 + hash(i, k3 + 5) * R * 1.3);
          g.fillRect(wx, wy, 3, 1);
        }
        g.fillStyle = WATER[2];
        if (T === 'RIVER') {
          for (var wave = -1; wave <= 1; wave++)
            g.fillRect(Math.round(x - R * 0.55 + (wave & 1) * R * 0.2), Math.round(y + wave * R * 0.33), Math.max(3, Math.round(R * 0.65)), 1);
        } else {
          g.fillRect(Math.round(x - R * 0.35), Math.round(y - R * 0.15), Math.max(3, Math.round(R * 0.7)), 1);
          g.fillRect(Math.round(x - R * 0.2), Math.round(y + R * 0.15), Math.max(2, Math.round(R * 0.4)), 1);
        }
      } else if (T === 'BRIDGE') {
        g.fillStyle = '#8b6f43';
        g.fillRect(x - Math.round(R * 0.75), y - Math.round(R * 0.28), Math.round(R * 1.5), Math.round(R * 0.56));
        g.fillStyle = '#c7a870';
        g.fillRect(x - Math.round(R * 0.7), y - Math.round(R * 0.2), Math.round(R * 1.4), 2);
        g.fillStyle = '#6d5533';
        for (var k4 = -2; k4 <= 2; k4++) g.fillRect(x + k4 * Math.round(R * 0.3), y - Math.round(R * 0.25), 1, Math.round(R * 0.5));
      } else if (T === 'FORT') {
        g.strokeStyle = '#4a4335'; g.lineWidth = 2;
        hexPath(g, x, y, Math.round(R * 0.72)); g.stroke();
        g.fillStyle = '#8d8168';
        g.fillRect(x - 4, y - 1, 8, 3);
        g.fillRect(x - 1, y - 4, 3, 8);
      } else if (T === 'FARM') {
        g.strokeStyle = alt; g.lineWidth = 1;
        for (var row = -2; row <= 2; row++) {
          g.beginPath(); g.moveTo(x - R, y + row * R * 0.32 + R * 0.35);
          g.lineTo(x + R, y + row * R * 0.32 - R * 0.35); g.stroke();
        }
      } else if (T === 'AIRFIELD') {
        g.fillStyle = '#3d5059'; g.fillRect(x - R, y - R * 0.2, R * 2, R * 0.4);
        g.fillStyle = alt;
        for (var dash = -1; dash <= 1; dash++) g.fillRect(Math.round(x + dash * R * 0.48 - R * 0.15), y, Math.max(2, Math.round(R * 0.3)), 1);
      } else if (T === 'CITY') {
        g.fillStyle = alt;
        for (var block = -1; block <= 1; block++) {
          g.fillRect(Math.round(x + block * R * 0.45 - R * 0.13), Math.round(y - R * 0.52), Math.max(2, Math.round(R * 0.26)), Math.max(2, Math.round(R * 0.3)));
        }
      } else {
        g.fillStyle = alt;
        g.fillRect(x - Math.round(R * 0.8), y + Math.round(R * 0.3), Math.round(R * 1.6), Math.round(R * 0.4));
      }
      g.restore();
      /* hex grid line */
      hexPath(g, x, y, R);
      g.strokeStyle = 'rgba(10,14,18,0.55)'; g.lineWidth = 1; g.stroke();
      if (R >= 12) {
        g.beginPath();
        g.moveTo(Math.round(x - hw * 0.43), Math.round(y - R * 0.23));
        g.lineTo(Math.round(x), Math.round(y - R * 0.73));
        g.lineTo(Math.round(x + hw * 0.43), Math.round(y - R * 0.23));
        g.strokeStyle = 'rgba(255,255,255,0.09)'; g.stroke();
      }
      /* property building + owner ring */
      if (cell.prop) {
        var sp = { CITY: 'city', FARM: 'farm', FACTORY: 'factory', AIRFIELD: 'hangar', DEPOT: 'depot', HQ: 'hq' }[T];
        if (sp) drawArt(g, sp, x, y + Math.round(R * 0.1), HF.clamp(R / 16, 0.62, 1.5),
          cell.own < 0 ? 0 : cell.own, cell.own < 0, Math.round(hw * 1.15));
        if (cell.own >= 0) {
          var col = HF.SIDECOL[cell.own];
          hexPath(g, x, y, R - 1);
          g.strokeStyle = col.m; g.lineWidth = Math.max(1, Math.round(R * 0.1)); g.stroke();
        }
      }
    }
    V.dirtyTerr = true;
  }
  function ownershipSig(s) {
    var v = 0;
    for (var i = 0; i < s.cells.length; i++) { v = (v * 31 + s.cells[i].own * 7 + s.cells[i].cap + (HF.TCODE[s.cells[i].t] || 0)) >>> 0; }
    return v;
  }
  function drawArt(g, key, cx2x, cy, scale, side, grey, maxW) {
    var a = art(key, side || 0);
    if (!a) return null;
    var z = (scale === undefined || scale === null) ? 1 : scale;
    var w = a.w * z, h = a.h * z;
    if (maxW && w > maxW) { var f = maxW / w; w = maxW; h *= f; }
    w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
    if (grey) { g.save(); g.globalAlpha = 0.85; }
    g.drawImage(a.cv, Math.round(cx2x - w / 2), Math.round(cy - h / 2), w, h);
    if (grey) g.restore();
    return [w, h];
  }
  HF.drawArtAt = drawArt;

  /* ---------- camera ---------- */
  V.mapWH = function (s) {
    var R = V.cam.R, hw = HF.hexW(R);
    return [hw * (s.W + 0.5), 1.5 * R * s.H + 0.5 * R];
  };
  V.fit = function (s, pad) {
    pad = pad || 8;
    var r1 = Math.floor((V.h - pad * 2) / (1.5 * s.H + 0.5));
    var r2 = Math.floor((V.w - pad * 2) / (Math.sqrt(3) * (s.W + 0.5)));
    V.cam.R = HF.clamp(Math.max(V.RMIN, Math.min(r1, r2)), V.RMIN, V.RMAX);
    V.snap(s);
  };
  V.snap = function (s) {
    V.cam.R = V.cam.R | 0;
    var d = V.mapWH(s), mw = d[0], mh = d[1];
    if (mw <= V.w) V.cam.x = (mw - V.w) / 2;
    else V.cam.x = HF.clamp(V.cam.x, 0, mw - V.w);
    if (mh <= V.h) V.cam.y = (mh - V.h) / 2;
    else V.cam.y = HF.clamp(V.cam.y, 0, mh - V.h);
    V.dirtyTerr = true;
  };
  V.hexXY = function (s, i) {
    var R = V.cam.R;
    var c = i % s.W, r = (i / s.W) | 0;
    return [HF.hexCX(s, c, r, R), HF.hexCY(s, r, R)];
  };
  V.center = function (s, i) {
    var p = V.hexXY(s, i);
    V.cam.x = p[0] - V.w / 2;
    V.cam.y = p[1] - V.h / 2;
    V.snap(s);
  };
  V.screen = function (s, i) { var p = V.hexXY(s, i); return [p[0] - V.cam.x, p[1] - V.cam.y]; };
  V.pick = function (s, sx, sy) {
    var x = sx + V.cam.x, y = sy + V.cam.y, R = V.cam.R, best = -1, bd = 1e9;
    var cand = HF.pxToHex(s, x, y, R);
    if (cand >= 0) {
      var p = V.hexXY(s, cand);
      bd = (p[0] - x) * (p[0] - x) + (p[1] - y) * (p[1] - y);
      best = cand;
    }
    return best;
  };

  /* ---------- effects ---------- */
  V.pop = function (s, i, txt, col, dy) {
    var p = V.hexXY(s, i);
    V.popups.push({ x: p[0], y: p[1] - (dy || 10), txt: txt, col: col || '#fff', t: 0, life: 900 });
  };
  V.boom = function (s, i) { V.fx.push({ i: i, t: 0, life: 460, k: 'boom' }); };
  V.hit = function (s, a, b) { V.fx.push({ a: a, b: b, t: 0, life: 260, k: 'shot' }); };

  /* ---------- frame ---------- */
  V.resize = function () {
    var box = V.cv.parentNode.getBoundingClientRect();
    V.dpr = Math.min(2, window.devicePixelRatio || 1);
    V.w = Math.max(80, Math.round(box.width));
    V.h = Math.max(80, Math.round(box.height));
    V.cv.width = Math.round(V.w * V.dpr);
    V.cv.height = Math.round(V.h * V.dpr);
    V.cv.style.width = V.w + 'px';
    V.cv.style.height = V.h + 'px';
    V.ctx = V.cv.getContext('2d');
    V.ctx.setTransform(V.dpr, 0, 0, V.dpr, 0, 0);
    V.ctx.imageSmoothingEnabled = false;
    V.dirtyTerr = true;
  };

  V.draw = function (s, ui) {
    var g = V.ctx;
    if (!g) return;
    g.setTransform(V.dpr, 0, 0, V.dpr, 0, 0);
    g.imageSmoothingEnabled = false;
    var th = THEME[s.theme] || THEME.plain;
    g.fillStyle = '#0a0e13';
    g.fillRect(0, 0, V.w, V.h);
    var key = s.stageIdx + ':' + V.cam.R + ':' + ownershipSig(s);
    if (V.dirtyTerr || key !== terrKey) { buildTerrain(s); V.dirtyTerr = false; terrKey = key; }
    g.save();
    g.translate(-Math.round(V.cam.x), -Math.round(V.cam.y));

    /* terrain bitmap */
    g.drawImage(terr, 0, 0);

    /* capture pips */
    for (var i = 0; i < s.cells.length; i++) {
      var cell = s.cells[i];
      if (!cell.cap || cell.capSide < 0) continue;
      var p = V.hexXY(s, i), R = V.cam.R;
      var need = HF.TERR[cell.t].cap;
      for (var q = 0; q < need; q++) {
        g.fillStyle = 'rgba(8,12,16,0.8)';
        g.fillRect(Math.round(p[0] - need * 3 + q * 6) - 1, Math.round(p[1] + R * 0.62) - 1, 7, 5);
        g.fillStyle = q < cell.cap ? HF.SIDECOL[cell.capSide].l : 'rgba(255,255,255,0.25)';
        g.fillRect(Math.round(p[0] - need * 3 + q * 6), Math.round(p[1] + R * 0.62), 5, 3);
      }
    }

    /* range overlays */
    if (ui && ui.moveSet) {
      var R2 = V.cam.R;
      for (var m = 0; m < s.cells.length; m++) {
        if (!ui.moveSet[m]) continue;
        var pm = V.hexXY(s, m);
        hexPath(g, pm[0], pm[1], R2 - 1);
        g.fillStyle = ui.moveCost && ui.moveCost[m] >= 0 ? 'rgba(80,200,120,0.24)' : 'rgba(80,200,120,0.12)';
        g.fill();
        g.strokeStyle = 'rgba(158,239,173,0.5)'; g.lineWidth = 1; g.stroke();
      }
    }
    if (ui && ui.atkSet) {
      var R3 = V.cam.R;
      for (var m2 = 0; m2 < s.cells.length; m2++) {
        if (!ui.atkSet[m2]) continue;
        var pm2 = V.hexXY(s, m2);
        hexPath(g, pm2[0], pm2[1], R3 - 1);
        g.fillStyle = 'rgba(190,55,42,0.12)'; g.fill();
        g.strokeStyle = 'rgba(240,90,70,0.85)'; g.lineWidth = 1; g.stroke();
      }
    }
    if (ui && ui.hlFrom >= 0) {
      var pf = V.hexXY(s, ui.hlFrom);
      hexPath(g, pf[0], pf[1], V.cam.R - 1);
      g.strokeStyle = 'rgba(255,220,120,0.9)'; g.lineWidth = 2; g.stroke();
    }

    /* units */
    var order = s.units.slice().sort(function (a, b) { return (a.i % 3) - (b.i % 3) || a.i - b.i; });
    for (var u2 = 0; u2 < order.length; u2++) {
      var u = order[u2], D = HF.UNITS[u.t];
      var pos = null;
      if (ui && ui.anim && ui.anim.moving && ui.anim.moving.id === u.id) pos = ui.anim.moving.xy;
      var pp = pos || V.hexXY(s, u.i);
      var R4 = V.cam.R;
      /* plate */
      hexPath(g, pp[0], pp[1], R4 * 0.86);
      g.fillStyle = 'rgba(8,12,16,0.42)'; g.fill();
      g.strokeStyle = HF.SIDECOL[u.side].m; g.lineWidth = Math.max(1, Math.round(R4 * 0.08)); g.stroke();
      var a = art(D.sp, u.side);
      if (a) {
        var scale = (D.cls === 'AIR') ? 0.62 : 1;
        var px = Math.max(1, Math.round(R4 / 12));
        var w = Math.round(a.w * scale * px), h = Math.round(a.h * scale * px);
        var maxH = Math.round(R4 * 1.7), maxW = Math.round(HF.hexW(R4) * (D.cls === 'AIR' ? 1.75 : 1.06));
        if (w > maxW || h > maxH) { var f = Math.min(maxW / w, maxH / h); w = Math.max(1, Math.round(w * f)); h = Math.max(1, Math.round(h * f)); }
        if (u.acted && u.attacked && !(ui && ui.anim && ui.anim.moving && ui.anim.moving.id === u.id)) g.globalAlpha = 0.62;
        g.drawImage(a.cv, Math.round(pp[0] - w / 2), Math.round(pp[1] - h / 2), w, h);
        g.globalAlpha = 1;
      }
      /* Unit codes remain visible even when the map is zoomed out. */
      var badgeFont = HF.clamp(Math.round(R4 * 0.45), 6, 10);
      g.font = 'bold ' + badgeFont + 'px ui-monospace,Consolas,monospace';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      var badgeW = Math.min(Math.round(HF.hexW(R4) * 0.9), Math.ceil(g.measureText(D.s).width) + 4);
      var badgeY = Math.round(pp[1] - R4 * 0.78);
      g.fillStyle = 'rgba(8,12,16,0.92)';
      g.fillRect(Math.round(pp[0] - badgeW / 2), badgeY, badgeW, badgeFont + 3);
      g.fillStyle = HF.SIDECOL[u.side].l;
      g.fillRect(Math.round(pp[0] - badgeW / 2), badgeY, badgeW, 1);
      g.fillStyle = '#ffffff';
      g.fillText(D.s, Math.round(pp[0]), badgeY + (badgeFont + 4) / 2, badgeW - 2);
      g.textBaseline = 'alphabetic';
      /* hp bar */
      if (u.hp < 100) {
        var bw = Math.round(R4 * 1.1);
        g.fillStyle = '#10161c'; g.fillRect(pp[0] - bw / 2, pp[1] + R4 * 0.62, bw, 3);
        g.fillStyle = u.hp > 60 ? '#67c96a' : (u.hp > 30 ? '#e0b73c' : '#d9584a');
        g.fillRect(pp[0] - bw / 2, pp[1] + R4 * 0.62, Math.max(1, Math.round(bw * u.hp / 100)), 3);
      }
      /* supply warnings */
      if (D.ammo >= 0 && u.ammo === 0) { g.fillStyle = '#d9584a'; g.fillRect(pp[0] + R4 * 0.5, pp[1] + R4 * 0.3, 3, 3); }
      if (u.fuel < HF.UNITS[u.t].fuel * 5) { g.fillStyle = '#e0b73c'; g.fillRect(pp[0] - R4 * 0.65, pp[1] + R4 * 0.3, 3, 3); }
      if (u.car.length) { g.fillStyle = '#cfe6f7'; g.fillRect(pp[0] - 2, pp[1] + R4 * 0.48, 4, 2); }
      if (s.side === u.side && !u.acted && !u.attacked && !s.over && s.side === 0) {
        g.fillStyle = 'rgba(255,255,255,0.85)';
        g.fillRect(pp[0] + R4 * 0.45, pp[1] - R4 * 0.28, 2, 3);
      }
    }

    /* selection cursor */
    if (ui && ui.sel >= 0) {
      var ps = V.hexXY(s, ui.sel), t = (Date.now() % 700) / 700;
      hexPath(g, ps[0], ps[1], V.cam.R * (0.9 + 0.06 * Math.sin(t * 6.283)));
      g.strokeStyle = '#ffe58a'; g.lineWidth = 2; g.stroke();
    }
    if (ui && ui.hover >= 0) {
      var ph = V.hexXY(s, ui.hover);
      hexPath(g, ph[0], ph[1], V.cam.R - 2);
      g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1; g.stroke();
    }

    /* fx */
    for (var f = V.fx.length - 1; f >= 0; f--) {
      var e = V.fx[f];
      e.t += V.dt || 16;
      if (e.t > e.life) { V.fx.splice(f, 1); continue; }
      var pr = e.t / e.life;
      if (e.k === 'boom') {
        var pi = V.hexXY(s, e.i);
        var frame = ['boom0', 'boom1', 'boom2'][Math.min(2, Math.floor(pr * 3))];
        var ba = art(frame, 0);
        var sz = Math.round(V.cam.R * (1.3 + pr * 0.7));
        if (ba) g.drawImage(ba.cv, Math.round(pi[0] - sz / 2), Math.round(pi[1] - sz / 2), sz, sz);
      } else if (e.k === 'shot') {
        var pa = V.hexXY(s, e.a), pb = V.hexXY(s, e.b);
        var progress = Math.min(1, pr * 2.2);
        g.strokeStyle = 'rgba(255,240,180,' + (1 - pr).toFixed(2) + ')';
        g.lineWidth = 2;
        g.beginPath(); g.moveTo(pa[0], pa[1]); g.lineTo(pa[0] + (pb[0] - pa[0]) * progress, pa[1] + (pb[1] - pa[1]) * progress); g.stroke();
        if (progress === 1) {
          var spark = Math.max(2, Math.round(V.cam.R * (0.18 + pr * 0.25)));
          g.fillStyle = 'rgba(255,220,130,' + (1 - pr).toFixed(2) + ')';
          g.fillRect(Math.round(pb[0] - spark), Math.round(pb[1] - 1), spark * 2 + 1, 3);
          g.fillRect(Math.round(pb[0] - 1), Math.round(pb[1] - spark), 3, spark * 2 + 1);
        }
      }
    }
    /* popups */
    for (var q2 = V.popups.length - 1; q2 >= 0; q2--) {
      var pp2 = V.popups[q2];
      pp2.t += V.dt || 16;
      if (pp2.t > pp2.life) { V.popups.splice(q2, 1); continue; }
      var pr2 = pp2.t / pp2.life;
      g.globalAlpha = Math.max(0, 1 - pr2 * pr2);
      g.font = 'bold ' + Math.round(9 + V.cam.R * 0.28) + 'px ui-monospace,Consolas,monospace';
      g.textAlign = 'center';
      g.fillStyle = '#0b0f14';
      g.fillText(pp2.txt, pp2.x + 1, pp2.y - pr2 * 16 + 1);
      g.fillStyle = pp2.col;
      g.fillText(pp2.txt, pp2.x, pp2.y - pr2 * 16);
      g.globalAlpha = 1;
    }
    g.restore();
    /* vignette + edge fade keeps the HUD readable */
    var gr = g.createLinearGradient(0, 0, 0, V.h);
    gr.addColorStop(0, 'rgba(6,9,13,0.55)'); gr.addColorStop(0.16, 'rgba(6,9,13,0)');
    gr.addColorStop(0.84, 'rgba(6,9,13,0)'); gr.addColorStop(1, 'rgba(6,9,13,0.5)');
    g.fillStyle = gr; g.fillRect(0, 0, V.w, V.h);
  };
})();
