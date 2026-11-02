/* ===== HEXFRONT :: boot, main loop, title backdrop, debug hooks ===== */
(function () {
  var M = HF.main = {};
  var demo = null, demoR = 12;

  function makeDemo() {
    var stg = HF.STAGES[3 + (Date.now() % 5)];
    demo = HF.genMap(stg);
    demo.stageIdx = HF.STAGES.indexOf(stg);
    demo.stage = stg;
    demo.cells.forEach(function (c, i) { if (c.prop && c.own < 0) c.own = (i % 5 === 0) ? 0 : (i % 7 === 0 ? 1 : -1); });
    demo.theme = stg.theme;
    demo.hq = [-1, -1];
    demo.units = [];
    demo.occ = new Int32Array(demo.cells.length);
    demo.turn = 1; demo.side = 0; demo.over = null; demo.limit = stg.limit;
    demo.funds = [0, 0]; demo.log = [];
    HF.view.cam.R = demoR;
    HF.view.fit(demo);
    HF.view.cam.R = Math.min(HF.view.cam.R + 6, HF.view.RMAX);
    HF.view.snap(demo);
  }

  function driftDemo(dt) {
    if (!demo) return;
    var d = HF.view.mapWH(demo), mw = d[0], mh = d[1];
    HF.view.cam.x += dt * 0.022;
    if (HF.view.cam.x > mw - HF.view.w) { HF.view.cam.x = 0; }
    HF.view.cam.y = HF.clamp(HF.view.cam.y, 0, Math.max(0, mh - HF.view.h));
    HF.view.dirtyTerr = false;
  }

  var last = 0;
  function frame(now) {
    var dt = Math.min(60, now - (last || now));
    last = now;
    HF.ui.step(now, dt);
    var s = HF.ui.st || demo;
    if (s) {
      if (!HF.ui.st) driftDemo(dt);
      HF.view.draw(s, HF.ui.st ? HF.ui : null);
    }
    requestAnimationFrame(frame);
  }

  M.boot = function () {
    HF.ui.init();
    makeDemo();
    var rot = document.getElementById('rotate');
    if (rot) rot.style.display = (window.innerHeight > window.innerWidth * 1.05 && window.innerWidth < 820) ? 'flex' : 'none';
    if (location.search.indexOf('debug=1') >= 0) { HF.ui.cheat = true; }
    var sv = HF.readSave();
    if (sv && sv.lang && HF.LANGS.indexOf(sv.lang) >= 0 && !HF.loadProfile().lang) { HF.lang = sv.lang; HF.ui.applyLang(); }
    requestAnimationFrame(frame);
  };

  /* ---------- test / screenshot helpers ---------- */
  HF.ui.dbg = {
    start: function (idx, diff) {
      if (diff) { HF.ui.prof.diff = diff; HF.saveProfile(HF.ui.prof); }
      HF.ui.startGame(idx);
      return HF.ui.st ? HF.ui.st.turn : null;
    },
    autoTurns: function (n) {
      var s = HF.ui.st;
      if (!s) return 'nostate';
      for (var k = 0; k < n && !s.over; k++) {
        if (s.side === 0) HF.aiTurn(s);
        HF.endTurn(s);
        if (!s.over && s.side === 1) { HF.aiTurn(s); HF.endTurn(s); }
      }
      HF.ui.queue = []; HF.view.anim = null; HF.view.popups.length = 0; HF.view.fx.length = 0;
      if (s.over) HF.ui.onGameOver(); else HF.ui.save();
      HF.ui.refreshHud(); HF.ui.renderLog(); HF.ui.refreshActs();
      return { turn: s.turn, over: s.over, units: s.units.length, funds: s.funds.slice() };
    },
    tap: function (i) { HF.ui.tapHex(i); },
    end: function () { HF.ui.endTurn(); },
    zoom: function (d) { HF.ui.zoom(d); },
    fit: function () { if (HF.ui.st) HF.view.fit(HF.ui.st); },
    center: function (i) { if (HF.ui.st) HF.view.center(HF.ui.st, i); },
    fx: function () {
      var s = HF.ui.st || demo;
      if (!s) return 'nostate';
      var i = Math.floor(s.cells.length / 2);
      HF.view.boom(s, i);
      HF.view.pop(s, i, '-42', '#ffd27a');
      HF.view.hit(s, i - 1, i);
      return 'ok';
    },
    screen: function (kind) { HF.ui.renderScreen(kind); return HF.ui.openScreen || 'title'; },
    close: function () { HF.ui.closeSheet(); },
    select: function (id) { var u = HF.byId(HF.ui.st, id); if (u) HF.ui.selectUnit(u); },
    cheat: function () { HF.ui.cheat = true; },
    save: function () { HF.ui.save(); return HF.store.get(HF.SAVE_KEY) ? 'ok' : 'fail'; },
    hasSave: function () { return !!HF.readSave(); },
    state: function () {
      var s = HF.ui.st; if (!s) return null;
      return { turn: s.turn, side: s.side, funds: s.funds.slice(), units: s.units.length, over: s.over, cells: s.cells.length, log: s.log.length };
    },
    buildHere: function (i, tid) { return HF.canBuild(HF.ui.st, i, 0, tid); },
    unitIds: function () { return HF.ui.st ? HF.ui.st.units.map(function (u) { return u.id; }) : []; }
  };
  function renderTo(kind) {
    if (kind === 'title') HF.ui.showTitle();
    else if (kind === 'stages') HF.openSheet('<div></div>', 'stages');
  }
  window.HFX = HF;
})();
