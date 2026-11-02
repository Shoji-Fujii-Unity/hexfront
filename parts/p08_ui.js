/* ===== HEXFRONT :: UI layer (DOM, input, screens) ===== */
(function () {
  var U = HF.ui = {
    st: null, sel: -1, selId: 0, infoCell: -1, phase: 'idle', busy: false, hist: [], hover: -1,
    moveSet: null, moveCost: null, atkSet: null, hlFrom: -1, cheat: false,
    el: {}, prof: null, queue: [], aiThink: 0, started: 0
  };

  var $ = function (id) { return document.getElementById(id); };
  var T = HF.T, L = HF.L;

  /* ---------- small helpers ---------- */
  function esc(x) { return String(x).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  U.esc = esc;
  function spriteCanvas(uid, side, sc) {
    var D = HF.UNITS[uid], a = HF.bakeArt(D.sp, side);
    if (!a) return null;
    var s = sc || 3;
    var wide = (D.cls === 'AIR');
    var w = Math.round(a.w * (wide ? 0.62 : 1) * s), h = Math.round(a.h * (wide ? 0.62 : 1) * s);
    var cv = document.createElement('canvas');
    cv.width = w; cv.height = h; cv.className = 'spr';
    var g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(a.cv, 0, 0, w, h);
    return cv;
  }
  U.spriteCanvas = spriteCanvas;
  U.toast = function (msg, ms) {
    var t = U.el.toast;
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(U._tt);
    U._tt = setTimeout(function () { t.classList.remove('on'); }, ms || 1700);
  };
  U.logHtml = function (e) {
    var s = T(e.k, e.v);
    return s;
  };

  /* ---------- boot / screens ---------- */
  U.init = function () {
    ['top', 'bot', 'cv', 'panel', 'acts', 'logList', 'toast', 'modal', 'sheet', 'hintLine', 'zoom', 'rotate', 'rotateGo'].forEach(function (id) { U.el[id] = $(id); });
    U.prof = HF.loadProfile();
    HF.lang = HF.pickLang(U.prof.lang);
    HF.soundOn = U.prof.sound !== 0;
    HF.musicOn = U.prof.music !== 0;
    U.el.cv = $('cv');
    HF.view.cv = U.el.cv;
    HF.view.resize();
    wireInput();
    wireChrome();
    applyLang();
    showTitle();
  };

  function applyLang() {
    document.documentElement.lang = HF.lang === 'ja' ? 'ja' : (HF.lang === 'zh' ? 'zh-CN' : 'en');
    var nodes = document.querySelectorAll('[data-t]');
    for (var i = 0; i < nodes.length; i++) {
      var k = nodes[i].getAttribute('data-t');
      var v = T(k);
      if (v.indexOf('<') >= 0) nodes[i].innerHTML = v; else nodes[i].textContent = v;
    }
    var tips = document.querySelectorAll('[data-tt]');
    for (var j = 0; j < tips.length; j++) tips[j].title = T(tips[j].getAttribute('data-tt'));
    U.el.bLang && (U.el.bLang.textContent = HF.lang.toUpperCase());
    U.el.bSound && (U.el.bSound.textContent = HF.soundOn ? '♪' : '✕');
    U.el.bSound && U.el.bSound.classList.toggle('off', !HF.soundOn);
    U.el.bSound && U.el.bSound.setAttribute('aria-label', T('set.sound') + ': ' + T(HF.soundOn ? 'set.on' : 'set.off'));
    U.el.bSound && U.el.bSound.setAttribute('aria-pressed', HF.soundOn ? 'true' : 'false');
    if (U.st) {
      refreshHud(); renderLog();
      var infoUnit = U.selId ? HF.byId(U.st, U.selId) : (U.infoCell >= 0 ? HF.unitAt(U.st, U.infoCell) : null);
      refreshPanel(infoUnit, U.infoCell);
    }
    if (U.openScreen) renderScreen(U.openScreen);
  }
  U.applyLang = applyLang;

  /* ---------- chrome buttons ---------- */
  function wireChrome() {
    U.el.bSound = $('bSound'); U.el.bLang = $('bLang'); U.el.bMenu = $('bMenu');
    U.el.bEnd = $('bEnd'); U.el.bUndo = $('bUndo'); U.el.bFit = $('bFit');
    U.el.bIn = $('bIn'); U.el.bOut = $('bOut');
    U.el.bSound.onclick = function () {
      HF.soundOn = !HF.soundOn; U.prof.sound = HF.soundOn ? 1 : 0; HF.saveProfile(U.prof);
      U.el.bSound.textContent = HF.soundOn ? '♪' : '✕';
      U.el.bSound.classList.toggle('off', !HF.soundOn);
      U.el.bSound.setAttribute('aria-label', T('set.sound') + ': ' + T(HF.soundOn ? 'set.on' : 'set.off'));
      U.el.bSound.setAttribute('aria-pressed', HF.soundOn ? 'true' : 'false');
      if (HF.soundOn) HF.sfx('click');
      U.toast(T('set.sound') + ': ' + T(HF.soundOn ? 'set.on' : 'set.off'));
    };
    U.el.bLang.onclick = function () {
      var i = HF.LANGS.indexOf(HF.lang);
      HF.lang = HF.LANGS[(i + 1) % HF.LANGS.length];
      U.prof.lang = HF.lang; HF.saveProfile(U.prof);
      applyLang(); HF.sfx('click');
      U.toast(HF.LANGNAME[HF.lang]);
    };
    U.el.bMenu.onclick = function () { HF.sfx('click'); openMenu(); };
    U.el.bEnd.onclick = function () { endTurn(); };
    U.el.bUndo.onclick = function () { undo(); };
    U.el.bFit.onclick = function () { HF.view.fit(U.st); HF.sfx('click'); };
    U.el.bIn.onclick = function () { zoom(1); };
    U.el.bOut.onclick = function () { zoom(-1); };
    $('rotateGo').onclick = function () { document.getElementById('rotate').style.display = 'none'; };
    window.addEventListener('resize', function () { onResize(); });
    window.addEventListener('orientationchange', function () { setTimeout(onResize, 260); });
    window.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', function () { if (HF.musicOn) HF.audioArm(); });
    document.addEventListener('keydown', function () { if (HF.musicOn) HF.audioArm(); });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) HF.musicPause();
      else if (HF.audio.ctx && HF.musicOn) HF.audioArm();
    });
    window.addEventListener('pagehide', function () { HF.musicPause(); if (U.st && !U.st.over) save(); });
    window.addEventListener('pageshow', function () { if (HF.audio.ctx && HF.musicOn) HF.audioArm(); });
  }
  function onResize() {
    HF.view.resize();
    if (U.st) HF.view.snap(U.st);
    $('rotate').style.display = (window.innerHeight > window.innerWidth * 1.05 && window.innerWidth < 820) ? 'flex' : 'none';
  }
  function zoom(dir) {
    if (!U.st) return;
    var old = HF.view.cam.R;
    HF.view.cam.R = HF.clamp(old + dir * (old > 16 ? 3 : 2), HF.view.RMIN, HF.view.RMAX);
    HF.view.snap(U.st);
    HF.sfx('click');
  }
  U.zoom = zoom;

  /* ---------- title / stage select ---------- */
  function showTitle() {
    U.st = null; U.openScreen = null; closeSheet();
    var sv = HF.readSave();
    var html = '<div class="title"><div class="lg">HEXFRONT</div><div class="sub">' + T('screen.sub') + '</div></div>';
    html += '<div class="col">';
    if (sv) html += '<button class="big primary" data-act="resume">' + T('b.continue') + ' <span class="mut">' + T('title.saved', { n: sv.st.turn }) + '</span></button>';
    html += '<button class="big" data-act="stages">' + T('b.new') + '</button>';
    html += '<div class="row2"><button data-act="stages">' + T('b.stages') + '</button><button data-act="codex">' + T('b.codex') + '</button></div>';
    html += '<div class="row2"><button data-act="help">' + T('b.help') + '</button><button data-act="set">' + T('b.settings') + '</button></div>';
    html += '</div>';
    html += '<div class="foot mut">' + T('title.progress', { n: U.prof.unlocked, m: HF.STAGES.length }) +
      ' · ' + (HF.store.available() ? T('set.storage.ok') : T('set.storage.no')) + '</div>';
    openSheet(html, 'title');
  }
  U.showTitle = showTitle;
  U.renderScreen = renderScreen;

  function renderScreen(kind) {
    if (kind === 'stages') renderStages();
    else if (kind === 'codex') renderCodex();
    else if (kind === 'help') renderHelp();
    else if (kind === 'set') renderSettings();
    else if (kind === 'menu') renderMenu();
    else if (kind === 'result') renderResult();
    else if (kind === 'title') showTitle();
  }

  function renderStages() {
    U.openScreen = 'stages';
    var h = '<div class="sh"><h2>' + T('stages.title') + '</h2><div class="diffs">';
    ['easy', 'normal', 'hard'].forEach(function (d) {
      h += '<button class="chip' + (U.prof.diff === d ? ' on' : '') + '" data-act="diff" data-arg="' + d + '">' + T('diff.' + d) + '</button>';
    });
    h += '</div></div><div class="grid stages">';
    for (var i = 0; i < HF.STAGES.length; i++) {
      var st = HF.STAGES[i], locked = (i + 1) > U.prof.unlocked;
      var best = U.prof.best[st.id];
      h += '<button class="card' + (locked ? ' lock' : '') + '" ' + (locked ? 'disabled' : 'data-act="play" data-arg="' + i + '"') + '>';
      h += '<div class="cid">' + T('hud.stage') + ' ' + st.id + '</div>';
      h += '<div class="cnm">' + esc(L(st.n)) + '</div>';
      h += '<div class="cinfo">' + T('stages.size', { w: st.sz[0], h: st.sz[1] }) + ' · ' + T('stages.turnlimit', { n: st.limit }) + '</div>';
      h += '<div class="cbr">' + esc(L(st.b)) + '</div>';
      h += '<div class="cfoot">' + (locked ? '<span class="mut">' + T('stages.locked') + '</span>' :
        (best ? '<span class="ok">' + T('stages.best', { n: best.turns }) + '</span>' : '<span class="mut">' + T('stages.norec') + '</span>')) + '</div>';
      h += '</button>';
    }
    h += '</div><div class="btnrow"><button data-act="close">' + T('b.back') + '</button></div>';
    openSheet(h, 'stages');
  }

  function renderHelp() {
    U.openScreen = 'help';
    var h = '<h2>' + T('help.title') + '</h2><div class="scroll">';
    for (var i = 0; i < 8; i++) {
      var t = T('help.t' + i), b = T('help.b' + i);
      if (!t || t === 'help.t' + i) continue;
      h += '<h3>' + t + '</h3><p>' + b.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>') + '</p>';
    }
    h += '<h3>' + T('help.t7') + '</h3>' + T('help.tab');
    h += '</div><div class="btnrow"><button data-act="close">' + T('b.close') + '</button></div>';
    openSheet(h, 'help');
  }

  function renderCodex() {
    U.openScreen = 'codex';
    var tiers = U.prof.unlocked ? HF.STAGES[Math.min(HF.STAGES.length, U.prof.unlocked) - 1].tiers : 1;
    function tableOf(kind) {
      var out = '<table class="cx"><tr><th></th><th>' + T('cod.cost') + '</th><th>' + T('cod.move') + '</th><th>' + T('cod.range') +
        '</th><th>' + T('cod.atk') + '</th><th>' + T('cod.ammo') + '</th><th>' + T('cod.fuel') + '</th><th>' + T('cod.cap') + '</th></tr>';
      HF.UIDS.forEach(function (uid) {
        var D = HF.UNITS[uid];
        if (D.build !== kind) return;
        var lock = D.tier > tiers;
        out += '<tr class="' + (lock ? 'lock' : '') + '"><td class="c1" data-u="' + uid + '"><div class="cxn"><span class="unitcode">' + esc(D.s) + '</span> ' + esc(L(D.n)) + (lock ? ' <span class="warn">' + T('misc.lock') + '</span>' : '') +
          '</div><div class="cxm">' + esc(D.models) + '</div>' +
          '<div class="cxd">' + esc(L(D.d)) + '</div></td><td>' + D.cost + '</td><td>' + D.mv + '</td><td>' + D.r0 + '-' + D.r1 + '</td><td>' + D.atk +
          '</td><td>' + (D.ammo < 0 ? '∞' : D.ammo) + '</td><td>' + D.fuel + '</td><td>' + (D.cap ? T('cod.yes') : T('cod.no')) + '</td></tr>';
        out += '<tr class="mulrow"><td colspan="8">' + T('cod.mult') + ': ' + HF.CLASSES.map(function (c) { return T('cls.' + c) + ' ×' + D.mul[c]; }).join(' · ') +
          ' · ' + T('dom.' + D.dom) + (D.ind ? ' · INDIR' : '') + (D.car ? ' · CARGO ' + D.car : '') + (D.desig ? ' · DESIGNATE' : '') + '</td></tr>';
      });
      out += '</table>';
      return out;
    }
    var h = '<h2>' + T('cod.title') + '</h2><div class="scroll tabs">';
    h += '<h3>' + T('cod.land') + '</h3>' + tableOf('LAND');
    h += '<h3>' + T('cod.air') + '</h3>' + tableOf('AIR');
    h += '<h3>' + T('cod.terr') + '</h3><table class="cx"><tr><th>' + T('cod.terr') + '</th><th>' + T('dom.F') + '/' + T('dom.W') + '/' + T('dom.T') + '</th><th>DEF</th><th>' + T('hud.income') + '</th></tr>';
    HF.TKEYS.forEach(function (k) {
      var D = HF.TERR[k];
      var cst = ['F', 'W', 'T'].map(function (d) { return D.cost[d] < 0 ? '—' : (D.cost[d] / 10); }).join('/');
      h += '<tr><td><div class="cxn">' + esc(L(D.n)) + '</div><div class="cxd">' + esc(L(D.d)) + '</div></td><td>' + cst + '</td><td>+' + D.def + '</td><td>' + (D.inc || '—') + '</td></tr>';
    });
    h += '</table><p class="mut">' + T('cod.terrainnote') + ' · ' + T('cod.locked') + ' = ' + T('stages.lockinfo') + '</p></div>';
    h += '<div class="btnrow"><button data-act="close">' + T('b.back') + '</button></div>';
    openSheet(h, 'codex');
    var cells = U.el.sheet.querySelectorAll('td[data-u]');
    for (var i = 0; i < cells.length; i++) {
      var cv = spriteCanvas(cells[i].getAttribute('data-u'), 0, 3);
      if (cv) { cv.className = 'spr big'; cells[i].insertBefore(cv, cells[i].firstChild); }
    }
  }

  function renderSettings() {
    U.openScreen = 'set';
    var h = '<h2>' + T('set.title') + '</h2><div class="setrow"><span>' + T('set.sound') + '</span><div>';
    h += '<button class="chip' + (HF.soundOn ? ' on' : '') + '" data-act="sound" data-arg="1">' + T('set.on') + '</button>';
    h += '<button class="chip' + (!HF.soundOn ? ' on' : '') + '" data-act="sound" data-arg="0">' + T('set.off') + '</button></div></div>';
    h += '<div class="setrow"><span>' + T('set.music') + '</span><div>';
    h += '<button class="chip' + (HF.musicOn ? ' on' : '') + '" data-act="music" data-arg="1">' + T('set.on') + '</button>';
    h += '<button class="chip' + (!HF.musicOn ? ' on' : '') + '" data-act="music" data-arg="0">' + T('set.off') + '</button></div></div>';
    h += '<div class="setrow"><span>' + T('set.lang') + '</span><div>';
    HF.LANGS.forEach(function (l) { h += '<button class="chip' + (HF.lang === l ? ' on' : '') + '" data-act="lang" data-arg="' + l + '">' + HF.LANGNAME[l] + '</button>'; });
    h += '</div></div>';
    h += '<div class="setrow"><span>' + T('set.diff') + '</span><div>';
    ['easy', 'normal', 'hard'].forEach(function (d) { h += '<button class="chip' + (U.prof.diff === d ? ' on' : '') + '" data-act="diff" data-arg="' + d + '">' + T('diff.' + d) + '</button>'; });
    h += '</div></div>';
    h += '<p class="mut">' + T('set.about') + '</p>';
    h += '<p class="mut">' + T('set.storage') + ': ' + (HF.store.available() ? T('set.storage.ok') : T('set.storage.no')) + ' · v' + HF.VER + (U.cheat ? ' [DEV]' : '') + '</p>';
    h += '<div class="btnrow"><button class="danger" data-act="erase">' + T('b.erase') + '</button><button data-act="close">' + T('b.back') + '</button></div>';
    openSheet(h, 'set');
  }

  function renderMenu() {
    U.openScreen = 'menu';
    var h = '<h2>' + T('menu.title') + '</h2><div class="col">';
    h += '<button data-act="stages">' + T('b.stages') + '</button>';
    h += '<button data-act="codex">' + T('b.codex') + '</button>';
    h += '<button data-act="help">' + T('b.help') + '</button>';
    h += '<button data-act="set">' + T('b.settings') + '</button>';
    h += '<button class="danger" data-act="quit">' + T('menu.quit') + '</button>';
    h += '</div><p class="mut">' + T('menu.save') + '</p>';
    openSheet(h, 'menu');
  }

  function renderResult() {
    U.openScreen = 'result';
    var o = U.st.over, win = o.win === 0;
    var st = U.st.stage, rec = U.prof.best[st.id];
    var h = '<div class="result ' + (win ? 'win' : 'lose') + '"><h2>' + T(win ? 'res.win' : 'res.lose') + '</h2>';
    h += '<div class="rsub">' + esc(L(st.n)) + ' · ' + T('res.turns', { n: o.turns }) + ' · ' + T('res.score', { n: o.score[0] + ' / ' + o.score[1] }) + '</div>';
    h += '<table class="kv"><tr><th></th><th>' + T('you') + '</th><th>' + T('enemy') + '</th></tr>';
    h += '<tr><td>' + T('res.ko').split('/')[0] + '</td><td>' + U.st.ko[0] + '</td><td>' + U.st.ko[1] + '</td></tr>';
    h += '<tr><td>' + T('hud.funds') + '</td><td>' + U.st.funds[0] + '</td><td>' + U.st.funds[1] + '</td></tr></table>';
    if (win && rec) h += '<div class="ok">' + (rec.fresh ? T('res.new') : T('res.best', { n: rec.turns })) + '</div>';
    if (win && U.prof.unlockedMsg) h += '<div class="ok">' + T('res.unlock', { n: U.prof.unlockedMsg }) + '</div>';
    h += '</div><div class="btnrow">';
    if (win && U.prof.unlocked > st.id) h += '<button class="primary" data-act="next">' + T('b.next') + '</button>';
    h += '<button data-act="replay">' + T('b.replay') + '</button>';
    h += '<button data-act="stages">' + T('b.stages') + '</button>';
    h += '<button data-act="title">' + T('b.back') + '</button></div>';
    openSheet(h, 'result');
  }

  /* ---------- sheets (modal) ---------- */
  function openSheet(html, kind) {
    U.el.sheet.innerHTML = html;
    U.el.modal.classList.add('on');
    U.el.modal.dataset.kind = kind || '';
    U.el.sheet.ontouchstart = null;
    U.el.sheet.querySelectorAll('[data-act]').forEach(bind);
  }
  U.openSheet = openSheet;
  function closeSheet() {
    U.el.modal.classList.remove('on');
    U.el.sheet.innerHTML = '';
    U.openScreen = null;
  }
  U.closeSheet = closeSheet;

  function bind(el) {
    el.onclick = function (e) {
      var a = el.getAttribute('data-act'), arg = el.getAttribute('data-arg');
      HF.sfx('click');
      if (a === 'close') closeSheet();
      else if (a === 'title') showTitle();
      else if (a === 'stages') renderStages();
      else if (a === 'codex') renderCodex();
      else if (a === 'help') renderHelp();
      else if (a === 'set') renderSettings();
      else if (a === 'menu') renderMenu();
      else if (a === 'result') renderResult();
      else if (a === 'play') { closeSheet(); startGame(parseInt(arg, 10)); }
      else if (a === 'resume') { closeSheet(); resumeGame(); }
      else if (a === 'diff') { U.prof.diff = arg; HF.saveProfile(U.prof); renderScreen(U.openScreen); }
      else if (a === 'lang') { HF.lang = arg; U.prof.lang = arg; HF.saveProfile(U.prof); applyLang(); renderScreen(U.openScreen); }
      else if (a === 'sound') { HF.soundOn = arg === '1'; U.prof.sound = arg === '1' ? 1 : 0; HF.saveProfile(U.prof); applyLang(); renderScreen(U.openScreen); }
      else if (a === 'music') { HF.musicOn = arg === '1'; U.prof.music = HF.musicOn ? 1 : 0; HF.saveProfile(U.prof); HF.musicUpdate(); renderSettings(); }
      else if (a === 'erase') {
        if (window.confirm(T('set.eraseq'))) { HF.clearSave(); U.prof = { v: 1, lang: HF.lang, sound: HF.soundOn ? 1 : 0, music: HF.musicOn ? 1 : 0, diff: 'normal', unlocked: 1, best: {}, seen: [], plays: 0 }; HF.saveProfile(U.prof); U.toast(T('set.erased')); renderSettings(); }
      } else if (a === 'quit') {
        if (U.st && !U.st.over) save();
        if (window.confirm(T('menu.quitq'))) showTitle();
      } else if (a === 'replay') { startGame(U.st.stageIdx); }
      else if (a === 'next') { startGame(Math.min(HF.STAGES.length - 1, U.st.stageIdx + 1)); }
      else if (a === 'build') { doBuild(parseInt(el.getAttribute('data-cell'), 10), arg); }
      else if (a === 'fire') { commitAttack(); }
      else if (a === 'cancel') { closeSheet(); if (U.pendingFire) U.pendingFire = null; }
      else if (a === 'end') { closeSheet(); endTurn(); }
    };
  }

  /* ---------- game start / save ---------- */
  function startGame(idx) {
    U.prof.plays++;
    HF.saveProfile(U.prof);
    U.st = HF.newGame(idx, U.prof.diff);
    U.sel = -1; U.selId = 0; U.infoCell = -1; U.phase = 'idle'; U.hist = []; U.busy = false;
    U.queue = []; U.moveSet = null; U.atkSet = null;
    U.started = Date.now();
    clearViewFx();
    HF.view.fit(U.st);
    closeSheet();
    applyLang();
    refreshHud(); renderLog(); refreshActs();
    U.toast(T('obj.hq'));
    save();
  }
  U.startGame = startGame;

  function resumeGame() {
    var sv = HF.readSave();
    if (!sv) { U.toast(T('save.none')); showTitle(); return; }
    var st = HF.unpack(sv.st);
    if (!st) { U.toast(T('save.none')); showTitle(); return; }
    U.st = st; U.sel = -1; U.selId = 0; U.infoCell = -1; U.phase = 'idle'; U.hist = []; U.busy = false; U.queue = [];
    U.moveSet = null; U.atkSet = null;
    clearViewFx();
    HF.view.fit(U.st);
    closeSheet(); applyLang(); refreshHud(); renderLog(); refreshActs();
    U.toast(T('save.found') + ' T' + st.turn);
    if (st.over) renderResult();
    else if (st.side === 1) setTimeout(function () { runAi(); }, 350);
  }
  U.resumeGame = resumeGame;

  function save() {
    if (!U.st) return;
    if (U.st.over) { HF.clearSave(); return; }
    HF.writeSave({ v: 1, at: Date.now(), lang: HF.lang, st: HF.pack(U.st) });
  }
  U.save = save;

  function pushHist() {
    if (!U.st) return;
    U.hist.push(JSON.stringify(HF.pack(U.st)));
    if (U.hist.length > 10) U.hist.shift();
    refreshActs();
  }
  function undo() {
    if (!U.st || U.busy || U.st.side !== 0 || !U.hist.length) { HF.sfx('deny'); return; }
    var st = HF.unpack(JSON.parse(U.hist.pop()));
    if (!st) return;
    U.st = st; U.sel = -1; U.selId = 0; U.phase = 'idle';
    U.moveSet = null; U.atkSet = null; clearViewFx();
    refreshHud(); renderLog(); refreshActs(); refreshPanel(null);
    HF.sfx('click'); save();
  }
  U.undo = undo;

  function clearViewFx() { HF.view.popups.length = 0; HF.view.fx.length = 0; HF.view.anim = null; }

  /* ---------- HUD ---------- */
  function refreshHud() {
    var s = U.st; if (!s) return;
    var st = s.stage;
    $('tStage').textContent = T('hud.stage') + ' ' + st.id;
    $('tName').textContent = L(st.n);
    $('tTurn').textContent = T('hud.turn') + ' ' + s.turn + '/' + s.limit;
    $('tFunds').textContent = s.funds[0];
    $('tInc').textContent = '+' + HF.incomeOf(s, 0).n;
    $('tUnits').textContent = HF.countUnits(s, 0) + '/' + s.capU;
    $('tPhase').textContent = s.over ? '' : T(s.side === 0 ? 'hud.phase.you' : 'hud.phase.enemy');
    $('tPhase').className = 'ph' + (s.side === 0 ? ' mine' : ' foe');
    $('tObj').textContent = T('obj.hq');
    U.el.bEnd.disabled = s.side !== 0 || !!s.over || U.busy;
    U.el.bUndo.disabled = !U.hist.length || s.side !== 0 || U.busy;
  }
  function renderLog() {
    var s = U.st; if (!s) return;
    var out = '';
    var tail = s.log.slice(-4);
    for (var i = 0; i < tail.length; i++) out += '<div class="ln">' + esc(U.logHtml(tail[i])) + '</div>';
    U.el.logList.innerHTML = out;
  }
  U.renderLog = renderLog;
  U.refreshHud = refreshHud;

  /* ---------- info panel ---------- */
  function refreshPanel(u, cellIdx) {
    var p = $('panel');
    if (!U.st) { p.innerHTML = ''; return; }
    U.infoCell = u ? u.i : (cellIdx >= 0 ? cellIdx : -1);
    var html = '';
    if (u) {
      var D = HF.UNITS[u.t];
      html += '<div class="ph2"><span><span class="unitcode">' + esc(D.s) + '</span> ' + esc(L(D.n)) + '</span><span class="own">' + T(HF.sideKey(u.side)) + '</span></div>';
      html += '<div class="models">' + esc(D.models) + '</div>';
      html += '<div class="bars">' + statBar(T('cod.hp'), u.hp, 100, u.hp > 60 ? 'g' : (u.hp > 30 ? 'y' : 'r'));
      if (D.ammo >= 0) html += statBar(T('cod.ammo'), u.ammo, D.ammo, u.ammo ? 'b' : 'r');
      html += statBar(T('cod.fuel'), Math.round(u.fuel / 10), D.fuel, u.fuel > D.fuel * 4 ? 'b' : 'y');
      html += '</div>';
      html += '<div class="stats">' + T('cod.cost') + ' ' + D.cost + ' · ' + T('cod.move') + ' ' + D.mv + ' · ' + T('cod.range') + ' ' + D.r0 + '-' + D.r1 +
        ' · ' + T('cod.atk') + ' ' + D.atk + '<br>' + T('dom.' + D.dom) + ' · ' + T('cls.' + D.cls) +
        (u.car.length ? ' · CARGO ' + u.car.map(function (c) { return L(HF.UNITS[c.t].n); }).join(', ') : '') + '</div>';
      if (u.i >= 0 && U.st.cells[u.i]) {
        var terrain = HF.TERR[U.st.cells[u.i].t];
        html += '<div class="note">' + esc(L(D.d)) + '</div>';
        html += '<div class="note">' + esc(L(terrain.n)) + ' DEF+' + terrain.def + ' · ' + esc(L(terrain.d)) + '</div>';
      }
    } else if (cellIdx >= 0) {
      var cell = U.st.cells[cellIdx], TD = HF.TERR[cell.t];
      html += '<div class="ph2">' + esc(L(TD.n)) + (cell.own >= 0 ? '<span class="own">' + T(HF.sideKey(cell.own)) + '</span>' : '') + '</div>';
      html += '<div class="note">' + esc(L(TD.d)) + '</div>';
      html += '<div class="stats">' + ['F', 'W', 'T'].map(function (dom) {
        return T('dom.' + dom) + ' ' + (TD.cost[dom] < 0 ? '—' : TD.cost[dom] / 10);
      }).join(' · ') + ' · DEF+' + TD.def + '</div>';
      var u2 = HF.unitAt(U.st, cellIdx);
      if (u2) html += '<div class="stats">' + esc(L(HF.UNITS[u2.t].n)) + ' ' + T('misc.hp', { n: u2.hp }) + '</div>';
      if (TD.cap && cell.cap > 0) html += '<div class="note warn">' + T('misc.captick', { n: cell.cap, m: TD.cap }) + '</div>';
      if (TD.inc) html += '<div class="stats">' + T('hud.income') + ' +' + TD.inc + '</div>';
    } else {
      html = '<div class="note">' + T('hud.hint') + '</div>';
    }
    p.innerHTML = html;
    p.classList.add('on');
  }
  function statBar(label, v, max, cls) {
    var w = Math.round(100 * HF.clamp(v / Math.max(1, max), 0, 1));
    return '<div class="sbar"><span>' + label + '</span><i class="' + cls + '" style="width:' + w + '%"></i><b>' + v + '</b></div>';
  }
  U.refreshPanel = refreshPanel;

  /* ---------- action bar ---------- */
  function refreshActs() {
    var s = U.st, box = U.el.acts;
    if (!s) { box.innerHTML = ''; return; }
    var u = U.selId ? HF.byId(s, U.selId) : null;
    var html = '';
    if (u && s.side === 0) {
      html += '<button data-act="aWait">' + T('a.wait') + '</button>';
      var carriers = HF.liveUnits(s, 0).filter(function (c) { return HF.canLoad(s, c, u); });
      if (carriers.length) html += '<button data-act="aLoad">' + T('a.load') + '</button>';
      if (u.car.length) html += '<button data-act="aUnload">' + T('a.unload') + '</button>';
      if (HF.canFort(s, u)) html += '<button data-act="aFort">' + T('a.fort') + ' ' + HF.FORT_COST + '</button>';
      if (HF.canDepot(s, u)) html += '<button data-act="aDepot">' + T('a.depot') + ' ' + HF.DEPOT_COST + '</button>';
    } else {
      var build = HF.liveUnits(s, 0).length, nb = 0;
      for (var i = 0; i < s.cells.length; i++) if (s.cells[i].own === 0 && HF.TERR[s.cells[i].t].build && !s.occ[i]) nb++;
      if (nb && s.side === 0 && !s.over) html += '<button data-act="aBuildList">' + T('a.build') + ' (' + nb + ')</button>';
    }
    box.innerHTML = html;
    Array.prototype.forEach.call(box.querySelectorAll('[data-act]'), function (el) {
      el.onclick = function () {
        HF.sfx('click');
        var a = el.getAttribute('data-act');
        if (a === 'aWait') waitSel();
        else if (a === 'aLoad') startLoad();
        else if (a === 'aUnload') startUnload();
        else if (a === 'aFort') doFort();
        else if (a === 'aDepot') doDepot();
        else if (a === 'aBuildList') buildList();
      };
    });
  }
  U.refreshActs = refreshActs;

  /* ---------- selection & orders ---------- */
  function clearSel() {
    U.sel = -1; U.selId = 0; U.phase = 'idle';
    U.moveSet = null; U.moveCost = null; U.atkSet = null; U.hlFrom = -1;
    refreshActs(); refreshPanel(null);
  }
  U.clearSel = clearSel;

  function selectUnit(u) {
    U.sel = u.i; U.selId = u.id; U.phase = 'ready';
    var r = HF.reach(U.st, u);
    U.moveCost = r.cost;
    U.moveSet = new Uint8Array(U.st.cells.length);
    for (var i2 = 0; i2 < U.st.cells.length; i2++) U.moveSet[i2] = r.stop[i2] && r.cost[i2] >= 0 ? 1 : 0;
    U.moveSet[u.i] = 1;
    U.hlFrom = u.i;
    U.atkSet = attackSet(u, u.i);
    HF.sfx('select');
    refreshActs(); refreshPanel(u);
    setHint(T('sel.mine'));
  }
  U.selectUnit = selectUnit;
  function attackSet(u, from) {
    var set = new Uint8Array(U.st.cells.length), D = HF.UNITS[u.t];
    if (U.st.side !== u.side || u.attacked) return set;
    if (D.ammo >= 0 && u.ammo <= 0) return set;
    var foes = HF.liveUnits(U.st, 1 - u.side);
    for (var k = 0; k < foes.length; k++) {
      var f = foes[k];
      if (!(D.mul[HF.UNITS[f.t].cls] > 0)) continue;
      var d = HF.distIdx(U.st, from, f.i);
      if (d < D.r0 || d > D.r1) continue;
      set[f.i] = 1;
    }
    return set;
  }
  function setHint(t) { U.el.hintLine.textContent = t; }
  U.setHint = setHint;

  U.tapHex = function (i) {
    var s = U.st;
    if (!s || U.busy || s.over) return;
    if (s.side !== 0) { setHint(T('hud.phase.enemy')); return; }
    var u = U.selId ? HF.byId(s, U.selId) : null;
    var other = HF.unitAt(s, i);
    var cell = s.cells[i];

    if (!u) {
      if (other && other.side === 0 && HF.canAct(s, other)) { selectUnit(other); return; }
      if (cell.own === 0 && HF.TERR[cell.t].build) { buildSheet(i); return; }
      refreshPanel(other, i);
      if (other && other.side === 1) setHint(T('sel.enemy'));
      else if (other) setHint(T('sel.done'));
      return;
    }
    /* we already picked up a unit: orders */
    if (i === u.i) { clearSel(); return; }
    if (U.atkSet && U.atkSet[i] && other && other.side === 1) { askFire(u, other); return; }
    if (U.moveSet && U.moveSet[i] && (!other || other.i === u.i)) { orderMove(u, i); return; }
    if (other && other.side === 0 && HF.canAct(s, other)) { selectUnit(other); return; }
    if (other && other.side === 1) {
      var D = HF.UNITS[u.t];
      setHint(D.ammo >= 0 && u.ammo <= 0 ? T('sel.noammo') : T('sel.cantattack'));
      HF.sfx('deny'); return;
    }
    setHint(T('sel.nostop')); HF.sfx('deny');
  };

  function orderMove(u, i) {
    pushHist();
    var ev = HF.doMove(U.st, u, i);
    if (!ev) { U.hist.pop(); HF.sfx('deny'); return; }
    U.sel = i; U.hlFrom = i;
    enqueue(ev);
    U.moveSet = null; U.moveCost = null;
    if (u.car.length) { /* transport may still drop cargo after moving: keep menu */ }
    var canFire = HF.canFire(U.st, u) && (HF.UNITS[u.t].ammo < 0 || u.ammo > 0);
    if (canFire) {
      U.phase = 'target';
      U.atkSet = attackSet(u, i);
      var any = false; for (var k = 0; k < U.atkSet.length; k++) if (U.atkSet[k]) { any = true; break; }
      setHint(any ? T('sel.after') : T('sel.done'));
      if (!any) finishUnit();
    } else finishUnit();
    refreshHud(); save();
  }
  function finishUnit() {
    U.atkSet = null;
    U.sel = -1; U.selId = 0; U.phase = 'idle'; U.moveSet = null; U.moveCost = null;
    refreshActs(); refreshPanel(null); setHint(T('hud.hint'));
  }
  function waitSel() {
    var u = U.selId ? HF.byId(U.st, U.selId) : null;
    if (!u) return;
    pushHist(); u.acted = 1; u.attacked = 1;
    finishUnit(); save();
  }
  function startLoad() {
    var u = HF.byId(U.st, U.selId);
    if (!u) return;
    var car = HF.liveUnits(U.st, 0).filter(function (c) { return HF.canLoad(U.st, c, u); })[0];
    if (!car) return;
    pushHist();
    var ev = HF.doLoad(U.st, car, u);
    if (ev) { enqueue(ev); finishUnit(); refreshHud(); save(); }
  }
  function startUnload() {
    var u = HF.byId(U.st, U.selId);
    if (!u || !u.car.length) return;
    pushHist();
    var ev = HF.doUnload(U.st, u, u.i);
    if (!ev) {
      /* pick the best adjacent landing spot by trying the reachable hexes */
      var r = HF.reach(U.st, u), best = -1;
      for (var i = 0; i < r.cost.length && best < 0; i++) {
        if (!r.stop[i] || r.cost[i] < 0) continue;
        if (HF.unloadSpots(U.st, u, i).length) best = i;
      }
      if (best >= 0) ev = HF.doUnload(U.st, u, best);
    }
    if (ev) {
      enqueue(ev);
      if (ev.at !== undefined) HF.view.pop(U.st, ev.at, L(HF.UNITS[u.car.length ? u.car[0].t : u.t].n), '#cfe6f7');
      finishUnit(); refreshHud(); save();
    } else { U.hist.pop(); HF.sfx('deny'); }
  }
  function doFort() {
    var u = HF.byId(U.st, U.selId);
    if (!u || !HF.canFort(U.st, u)) return;
    pushHist(); var ev = HF.doFort(U.st, u);
    if (ev) { enqueue(ev); finishUnit(); refreshHud(); save(); } else U.hist.pop();
  }
  function doDepot() {
    var u = HF.byId(U.st, U.selId);
    if (!u || !HF.canDepot(U.st, u)) return;
    pushHist(); var ev = HF.doDepot(U.st, u);
    if (ev) { enqueue(ev); finishUnit(); refreshHud(); save(); } else U.hist.pop();
  }

  /* ---------- fire ---------- */
  var pending = null;
  function askFire(a, t) {
    var fc = HF.forecast(U.st, a, t, a.i);
    if (!fc) { HF.sfx('deny'); setHint(T('sel.noammo')); return; }
    pending = { a: a.id, t: t.id };
    var an = L(HF.UNITS[a.t].n), tn = L(HF.UNITS[t.t].n);
    var h = '<div class="fire"><h3>' + T('fc.title') + '</h3>';
    h += '<div class="vs">' + esc(an) + ' → ' + esc(tn) + '</div>';
    h += '<div class="big">-' + fc.dmg + '</div>';
    h += '<div class="mut">' + T('fc.vs', { a: an, b: tn }) + ' ×' + fc.mul + ' · ' + T('fc.terr', { p: Math.round(fc.def * 6.2) }) + (fc.desig ? ' · UAV' : '') + '</div>';
    h += '<div class="ctr">' + (fc.counter ? T('fc.counter', { n: fc.counter }) : '<span class="ok">' + T('fc.nocounter') + '</span>') + '</div>';
    h += '<div class="btnrow"><button class="danger" data-act="fire">' + T('fc.go') + '</button><button data-act="cancel">' + T('b.cancel') + '</button></div></div>';
    openSheet(h, 'fire');
  }
  function commitAttack() {
    if (!pending) { closeSheet(); return; }
    var a = HF.byId(U.st, pending.a), t = HF.byId(U.st, pending.t);
    pending = null;
    closeSheet();
    if (!a || !t) return;
    pushHist();
    var ev = HF.doAttack(U.st, a, t, a.i);
    if (!ev) { U.hist.pop(); HF.sfx('deny'); return; }
    enqueue(ev);
    U.atkSet = null;
    finishUnit(); refreshHud(); save();
  }

  /* ---------- build ---------- */
  function buildList() {
    var s = U.st, cells = [];
    for (var i = 0; i < s.cells.length; i++) if (s.cells[i].own === 0 && HF.TERR[s.cells[i].t].build && !s.occ[i]) cells.push(i);
    if (!cells.length) { U.toast(T('build.out')); return; }
    if (cells.length === 1) { buildSheet(cells[0]); return; }
    var h = '<h3>' + T('a.build') + '</h3><div class="row2">';
    cells.forEach(function (c) {
      h += '<button data-act="gotoBuild" data-arg="' + c + '">' + esc(L(HF.TERR[s.cells[c].t].n)) + '</button>';
    });
    h += '</div><div class="btnrow"><button data-act="close">' + T('b.back') + '</button></div>';
    openSheet(h, 'buildlist');
    U.el.sheet.querySelectorAll('[data-act="gotoBuild"]').forEach(function (el) {
      el.onclick = function () { var c = parseInt(el.getAttribute('data-arg'), 10); HF.view.center(s, c); buildSheet(c); };
    });
  }
  function buildSheet(cellIdx) {
    var s = U.st, list = HF.buildable(s, cellIdx, 0);
    if (!list) { U.toast(T('build.out')); return; }
    var kind = HF.TERR[s.cells[cellIdx].t].build;
    var h = '<h3>' + T('build.title', { b: L(HF.TERR[s.cells[cellIdx].t].n) }) + ' <span class="mut">' + T('hud.funds') + ' ' + s.funds[0] + '</span></h3>';
    h += '<div class="bgrid">';
    list.forEach(function (tid) {
      var D = HF.UNITS[tid], ok = HF.canBuild(s, cellIdx, 0, tid);
      h += '<button class="bcard' + (ok === true ? '' : ' off') + '" data-build="' + tid + '">' +
        '<span class="bn">' + esc(L(D.n)) + '</span><span class="bm">' + esc(D.models) + '</span>' +
        '<span class="bs">' + T('cod.move') + ' ' + D.mv + ' · ' + T('cod.range') + ' ' + D.r0 + '-' + D.r1 + ' · ' + T('cod.atk') + ' ' + D.atk + '</span>' +
        '<span class="bc">' + D.cost + '</span>' + (ok === 'funds' ? '<span class="warn">Funds</span>' : '') +
        (ok === 'cap' ? '<span class="warn">' + T('build.noCap', { n: s.capU }) + '</span>' : '') + '</button>';
    });
    h += '</div><div class="btnrow"><button data-act="close">' + T('b.cancel') + '</button></div>';
    openSheet(h, 'build');
    U.el.sheet.querySelectorAll('[data-build]').forEach(function (el) {
      el.onclick = function () { doBuild(cellIdx, el.getAttribute('data-build')); };
    });
    /* sprites next to the names */
    var cards = U.el.sheet.querySelectorAll('.bcard');
    for (var k = 0; k < cards.length; k++) {
      var cv = spriteCanvas(list[k], 0, 3);
      if (cv) cards[k].insertBefore(cv, cards[k].firstChild);
    }
  }
  function doBuild(cellIdx, tid) {
    var s = U.st;
    if (HF.canBuild(s, cellIdx, 0, tid) !== true) { HF.sfx('deny'); U.toast(T('build.noFunds')); return; }
    pushHist();
    var ev = HF.doBuild(s, cellIdx, 0, tid);
    if (!ev) { U.hist.pop(); return; }
    closeSheet(); enqueue(ev);
    HF.view.pop(s, cellIdx, '+' + L(HF.UNITS[tid].n), '#9ee6a4');
    refreshHud(); refreshActs(); save();
  }
  function cheatBuild() {
    if (!U.cheat || !U.st || U.st.side !== 0) return;
    var cell = -1;
    for (var i = 0; i < U.st.cells.length; i++) if (U.st.cells[i].own === 0 && HF.TERR[U.st.cells[i].t].build === 'LAND' && !U.st.occ[i]) { cell = i; break; }
    if (cell < 0) return;
    var list = HF.buildable(U.st, cell, 0);
    var best = null;
    for (var k = 0; k < list.length; k++) if (!best || HF.UNITS[list[k]].cost > HF.UNITS[best].cost) best = list[k];
    U.st.funds[0] += HF.UNITS[best].cost;
    doBuild(cell, best);
  }

  /* ---------- turn flow + animation queue ---------- */
  function enqueue(ev) { U.queue.push(ev); }
  U.enqueue = enqueue;

  function endTurn() {
    var s = U.st;
    if (!s || U.busy || s.over || s.side !== 0) return;
    clearSel();
    pushHist();
    var evs = HF.endTurn(s);
    U.hist = [];
    for (var i = 0; i < evs.length; i++) U.queue.push(evs[i]);
    U.queue.push({ k: '_aiwait' });
    refreshHud(); save();
  }
  U.endTurn = endTurn;

  function runAi() {
    var s = U.st;
    if (!s || s.over || s.side === 0) return;
    U.busy = true;
    refreshHud();
    var evs = HF.aiTurn(s);
    for (var i = 0; i < evs.length; i++) U.queue.push(evs[i]);
    var e2 = HF.endTurn(s);
    for (var j = 0; j < e2.length; j++) U.queue.push(e2[j]);
    U.queue.push({ k: '_aifinish' });
    refreshHud(); save();
  }

  /* called every frame by main; returns true while animating */
  U.step = function (now, dt) {
    HF.view.dt = dt;
    var a = HF.view.anim;
    if (a) {
      a.t += dt;
      var p = Math.min(1, a.t / a.dur);
      if (a.kind === 'move') {
        var path = a.path;
        var f = p * (path.length - 1);
        var i0 = Math.floor(f), i1 = Math.min(path.length - 1, i0 + 1), fr = f - i0;
        var p0 = HF.view.hexXY(U.st, path[i0]), p1 = HF.view.hexXY(U.st, path[i1]);
        a.moving = { id: a.id, xy: [p0[0] + (p1[0] - p0[0]) * fr, p0[1] + (p1[1] - p0[1]) * fr] };
        if (p >= 1) { HF.view.anim = null; }
      } else if (a.kind === 'wait') {
        if (p >= 1) HF.view.anim = null;
      }
      return true;
    }
    if (!U.queue.length) { if (U.busy && !U.queue.length) U.busy = false; return false; }
    var ev = U.queue.shift();
    var s = U.st;
    if (!s) return false;
    if (ev.k === '_aiwait') { if (s.side === 1) runAi(); return false; }
    if (ev.k === '_aifinish') {
      U.busy = false; refreshHud(); refreshActs(); renderLog();
      if (!s.over) setHint(T('hud.hint'));
      save();
      return false;
    }
    if (ev.k === 'move') {
      HF.view.anim = { kind: 'move', t: 0, dur: Math.min(420, 90 + 40 * (ev.path.length - 1)), path: ev.path, id: ev.id, moving: null };
      HF.sfx('move');
    } else if (ev.k === 'attack') {
      HF.view.hit(s, ev.from, ev.to);
      HF.sfx('fire');
      setTimeout(function () {
        HF.view.pop(s, ev.to, '-' + ev.dmg, '#ffd27a');
        if (ev.tgtDead) { HF.view.boom(s, ev.to); HF.sfx('ko'); } else HF.sfx('hit');
        if (ev.counter > 0) { HF.view.pop(s, ev.from, '-' + ev.counter, '#ff9d8a', -6); }
        if (ev.atkKo) { HF.view.boom(s, ev.from); }
      }, 150);
      HF.view.anim = { kind: 'wait', t: 0, dur: 260 };
    } else if (ev.k === 'build') {
      HF.view.pop(s, ev.i, '+', '#9ee6a4'); HF.sfx('build');
      HF.view.anim = { kind: 'wait', t: 0, dur: 120 };
    } else if (ev.k === 'capture') {
      HF.view.pop(s, ev.i, L(HF.TERR[ev.prop].n), ev.side === 0 ? '#9ee6a4' : '#ff9d8a'); HF.sfx('capture');
    } else if (ev.k === 'hqfire') {
      HF.view.pop(s, ev.i, '-' + ev.dmg, '#ff9d8a'); HF.sfx('hit');
    } else if (ev.k === 'fort' || ev.k === 'depot') {
      HF.view.pop(s, ev.i, '+', '#9ee6a4'); HF.sfx('build');
      HF.view.dirtyTerr = true;
    } else if (ev.k === 'load' || ev.k === 'unload') {
      HF.sfx('move');
    } else if (ev.k === 'over') {
      onGameOver();
    } else if (ev.k === 'turnend') {
      HF.sfx('turn');
      renderLog(); refreshHud();
    }
    renderLog();
    return true;
  };

  U.onGameOver = onGameOver;
  function onGameOver() {
    var s = U.st, win = s.over.win === 0, st = s.stage;
    HF.sfx(win ? 'win' : 'lose');
    var rec = U.prof.best[st.id] || null;
    U.prof.unlockedMsg = null;
    if (win) {
      if (!rec || s.over.turns < rec.turns) U.prof.best[st.id] = { turns: s.over.turns, score: s.over.score[0], fresh: true };
      if (U.prof.unlocked < st.id + 1 && st.id + 1 <= HF.STAGES.length) {
        U.prof.unlocked = st.id + 1;
        U.prof.unlockedMsg = 'ST' + (st.id + 1);
        U.toast(T('tip.newstage') + ' ST' + (st.id + 1), 2600);
      }
    }
    HF.saveProfile(U.prof);
    HF.clearSave();
    clearSel();
    refreshHud();
    setTimeout(function () { if (U.st && U.st.over) renderResult(); }, 600);
  }

  /* ---------- pointer / touch ---------- */
  function wireInput() {
    var cv = U.el.cv, down = null, moved = 0, pinch = null, lastTouchDist = 0;
    function pos(e) { var r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
    cv.addEventListener('pointerdown', function (e) {
      HF.audioArm();
      if (!U.st) return;
      down = { x: e.clientX, y: e.clientY, cx: HF.view.cam.x, cy: HF.view.cam.y, id: e.pointerId, t: Date.now() };
      moved = 0;
      cv.setPointerCapture && cv.setPointerCapture(e.pointerId);
    });
    cv.addEventListener('pointermove', function (e) {
      if (!U.st) return;
      var p = pos(e);
      U.hover = HF.view.pick(U.st, p[0], p[1]);
      if (!down) return;
      var dx = e.clientX - down.x, dy = e.clientY - down.y;
      moved = Math.max(moved, Math.abs(dx) + Math.abs(dy));
      if (moved > 8) { HF.view.cam.x = down.cx - dx; HF.view.cam.y = down.cy - dy; HF.view.snap(U.st); }
    });
    cv.addEventListener('pointerup', function (e) {
      if (!U.st) return;
      if (moved <= 8) {
        var p = pos(e), i = HF.view.pick(U.st, p[0], p[1]);
        if (i >= 0) U.tapHex(i);
      } else HF.sfx('pan');
      down = null;
    });
    cv.addEventListener('pointercancel', function () { down = null; });
    cv.addEventListener('wheel', function (e) {
      if (!U.st) return;
      e.preventDefault();
      if (e.ctrlKey || Math.abs(e.deltaY) > 0) {
        var before = pos(e);
        var R0 = HF.view.cam.R;
        HF.view.cam.R = HF.clamp(R0 + (e.deltaY < 0 ? 2 : -2), HF.view.RMIN, HF.view.RMAX);
        var after = HF.view.hexXY ? [0, 0] : [0, 0];
        HF.view.snap(U.st);
      }
    }, { passive: false });
    /* two-finger pinch */
    var pts = {};
    cv.addEventListener('pointerdown', function (e) { pts[e.pointerId] = [e.clientX, e.clientY]; });
    cv.addEventListener('pointerup', function (e) { delete pts[e.pointerId]; });
    cv.addEventListener('pointermove', function (e) {
      if (!pts[e.pointerId]) return;
      pts[e.pointerId] = [e.clientX, e.clientY];
      var ids = Object.keys(pts);
      if (ids.length === 2) {
        var a = pts[ids[0]], b = pts[ids[1]];
        var d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        if (lastTouchDist) {
          var dr = (d - lastTouchDist) * 0.09;
          if (Math.abs(dr) >= 0.5) { HF.view.cam.R = HF.clamp(Math.round(HF.view.cam.R + dr), HF.view.RMIN, HF.view.RMAX); if (U.st) HF.view.snap(U.st); lastTouchDist = d; }
        }
        lastTouchDist = d;
        down = null;
      } else lastTouchDist = 0;
    });
  }

  function onKey(e) {
    if (e.target && e.target.tagName === 'INPUT') return;
    var k = e.key.toLowerCase();
    if (k === 'escape') { if (U.el.modal.classList.contains('on')) closeSheet(); else clearSel(); }
    else if (k === ' ' || k === 'enter') { if (U.st && !U.el.modal.classList.contains('on')) { e.preventDefault(); endTurn(); } }
    else if (k === 'u') undo();
    else if (k === 'f') { if (U.st) HF.view.fit(U.st); }
    else if (k === 'h') renderHelp();
    else if (k === 'c') renderCodex();
    else if (k === 'm') { HF.soundOn = !HF.soundOn; U.prof.sound = HF.soundOn ? 1 : 0; HF.saveProfile(U.prof); applyLang(); }
    else if (k === 'z') cheatBuild();
    else if (k === '+' || k === '=') zoom(1);
    else if (k === '-') zoom(-1);
  }
})();
