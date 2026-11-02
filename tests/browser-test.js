/* HEXFRONT browser test (headless Chrome over CDP, no extra packages).
   Usage:  node tests/browser-test2.js [--keep]   writes PNGs to tests/shots/
   Checks: boot, HUD layout, i18n cycling, sound toggle, every screen,
   tap-to-move, fire forecast, AI turn through the animation queue,
   save/resume, phone-landscape layout, portrait warning, a full big-map game. */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');
const SHOTS = path.join(__dirname, 'shots');
const PROFILE = path.join(os.tmpdir(), 'hexfront-cdp-profile');
const PORT = 9353;
const FILE_URL = 'file:///' + INDEX.replace(/\\/g, '/');

let pass = 0, fail = 0;
const fails = [];
function ok(cond, name, extra) {
  if (cond) pass++;
  else {
    fail++;
    fails.push(name + (extra ? ' :: ' + extra : ''));
    console.log('  x ' + name + (extra ? ' :: ' + extra : ''));
  }
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
  const chrome = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'].find(p => fs.existsSync(p));
  if (!chrome) { console.log('no Chrome found'); process.exit(2); }
  if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });

  const proc = spawn(chrome, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
    '--no-default-browser-check', '--mute-audio', '--window-size=1280,800',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + PROFILE,
    '--allow-file-access-from-files', 'about:blank'
  ], { stdio: 'ignore' });

  let target = null;
  for (let t = 0; t < 60 && !target; t++) {
    await sleep(300);
    try {
      const list = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json();
      target = list.find(x => x.type === 'page');
    } catch (e) { /* chrome still starting */ }
  }
  if (!target) { console.log('CDP endpoint never appeared'); proc.kill(); process.exit(1); }

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let idc = 0;
  const pending = new Map();
  const consoleErrs = [], pageErrs = [];
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); return; }
    if (msg.method === 'Runtime.consoleAPICalled' && (msg.params.type === 'error' || msg.params.type === 'warning')) {
      consoleErrs.push(msg.params.type + ': ' + (msg.params.args || []).map(a => a.value || a.description || a.type).join(' '));
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      pageErrs.push(String((d.exception && (d.exception.description || d.exception.value)) || d.text || '').split('\n')[0]);
    }
    if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') pageErrs.push('log:' + msg.params.entry.text);
  };
  const cmd = (method, params) => new Promise((res) => {
    const id = ++idc;
    pending.set(id, res);
    ws.send(JSON.stringify({ id, method, params: params || {} }));
  });
  async function ev(expr) {
    const r = await cmd('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails && r.exceptionDetails.exception && r.exceptionDetails.exception.description) {
      throw new Error('eval threw: ' + String(r.exceptionDetails.exception.description).split('\n')[0]);
    }
    return r.result && r.result.result ? r.result.result.value : undefined;
  }
  async function shot(name) {
    const r = await cmd('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(SHOTS, name + '.png'), Buffer.from(r.result.data, 'base64'));
    console.log('  shot ' + name + '.png');
  }
  const go = async (url) => { await cmd('Page.navigate', { url }); await sleep(1300); };
  const viewport = async (w, h, mobile) => {
    await cmd('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: !!mobile });
    await sleep(400);
  };
  async function settle(maxMs) {
    const t0 = Date.now();
    while (Date.now() - t0 < (maxMs || 12000)) {
      if (!(await ev('(function(){var u=HF.ui;return (u.queue&&u.queue.length)||u.busy||0;})()'))) return true;
      await sleep(200);
    }
    return false;
  }

  await cmd('Runtime.enable');
  await cmd('Page.enable');
  await cmd('Log.enable');

  /* ---------- boot ---------- */
  console.log('== boot at 1280x800 ==');
  await go(FILE_URL);
  ok(await ev('typeof HF === "object" && !!HF.ui && !!HF.view && !!HF.main'), 'engine globals present');
  ok(await ev('!!document.getElementById("cv")'), 'canvas element exists');
  ok((await ev('HF.STAGES.length')) === 12, 'all 12 stages loaded');
  ok(await ev('document.getElementById("modal").classList.contains("on")'), 'title screen open on boot');
  ok(await ev('document.getElementById("sheet").innerText.indexOf("HEXFRONT") >= 0'), 'title shows the game name');
  await shot('01-title-desktop');

  /* ---------- chrome layout ---------- */
  console.log('\n== chrome layout ==');
  const L = await ev('(function(){var cv=document.getElementById("cv");var r=cv.getBoundingClientRect();' +
    'return {cw:cv.width,ch:cv.height,x:r.width,y:r.height,iw:innerWidth,ih:innerHeight,' +
    'topB:(document.getElementById("top").getBoundingClientRect().bottom|0),' +
    'end:(document.getElementById("bEnd").getBoundingClientRect().bottom|0)};})()');
  ok(Math.round(L.x) === L.iw && Math.round(L.y) === L.ih, 'canvas covers the viewport', JSON.stringify(L));
  ok(L.cw >= L.iw, 'canvas backing store matches css size', L.cw + ' vs ' + L.iw);
  ok(L.end <= L.ih + 1, 'end-turn button inside the viewport', L.end + ' <= ' + L.ih);
  ok(L.topB < L.end, 'hud strip sits above the action bar');

  /* ---------- languages ---------- */
  console.log('\n== language cycle ==');
  const seen = [];
  for (let k = 0; k < 3; k++) {
    await ev('document.getElementById("bLang").click()');
    await sleep(150);
    seen.push(await ev('HF.lang'));
  }
  ok(seen.length === 3 && ['ja', 'en', 'zh'].every(l => seen.indexOf(l) >= 0),
    'language cycles through ja/en/zh', seen.join(','));
  for (const lang of ['en', 'zh', 'ja']) {
    await ev('HF.lang="' + lang + '";HF.ui.applyLang();HF.ui.showTitle();');
    await sleep(280);
    ok(await ev('(function(){var s=document.getElementById("sheet").innerText;' +
      'return s.length>60 && s.indexOf("{")<0 && s.indexOf("help.")<0 && s.indexOf("b.")<0;})()'),
      'title fully localised in ' + lang);
    ok((await ev('document.getElementById("bEnd").textContent.trim().length')) > 0, 'hud button label present in ' + lang);
  }
  await ev('HF.lang="ja";HF.ui.applyLang();HF.ui.showTitle();');
  await sleep(250);

  /* ---------- sound ---------- */
  console.log('\n== sound toggle ==');
  const s0 = await ev('HFX.loadProfile().sound');
  await ev('document.getElementById("bSound").click()');
  await sleep(200);
  const s1 = await ev('HFX.loadProfile().sound');
  ok(s0 !== s1, 'sound preference toggles', s0 + ' -> ' + s1);
  ok(await ev('document.getElementById("bSound").classList.contains("off")') === !s1, 'sound button reflects state');
  await ev('HFX.saveProfile(Object.assign(HFX.loadProfile(), { sound: true }));HF.ui.applyLang();');

  /* ---------- screens ---------- */
  console.log('\n== screens ==');
  for (const [kind, probe, min] of [
    ['stages', '#sheet .card', 12],
    ['codex', '#sheet table.cx tr', 15],
    ['help', '#sheet .scroll', 1],
    ['set', '#sheet button', 3]
  ]) {
    await ev('HF.ui.dbg.screen("' + kind + '")');
    await sleep(300);
    const n = await ev('document.querySelectorAll("' + probe + '").length');
    ok(n >= min, kind + ' screen has content', n + ' < ' + min);
    if (kind === 'codex') {
      ok(await ev('document.querySelectorAll("#sheet .unitcode").length === HF.UIDS.length'),
        'codex lists the map code for every unit');
      ok(await ev('document.getElementById("sheet").innerText.indexOf("NaN") < 0'),
        'terrain movement costs do not contain invalid numbers');
    }
    await shot('02-' + kind + '-desktop');
  }
  console.log('\n== music settings ==');
  ok(await ev('document.querySelectorAll(\'[data-act="music"]\').length === 2'),
    'settings exposes independent music controls');
  const musicButton = await ev('(function(){var r=document.querySelector(\'[data-act="music"][data-arg="1"]\').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()');
  await cmd('Input.dispatchMouseEvent', { type: 'mousePressed', x: musicButton.x, y: musicButton.y, button: 'left', clickCount: 1 });
  await cmd('Input.dispatchMouseEvent', { type: 'mouseReleased', x: musicButton.x, y: musicButton.y, button: 'left', clickCount: 1 });
  await sleep(350);
  ok(await ev('HF.musicOn && HF.audio.ctx && HF.audio.ctx.state === "running" && HF.audio.timer !== null'),
    'a user gesture starts the music scheduler');
  await ev('document.querySelector(\'[data-act="sound"][data-arg="0"]\').click()');
  ok(await ev('!HF.soundOn && HF.musicOn && HFX.loadProfile().sound === 0 && HFX.loadProfile().music === 1'),
    'muting effects leaves music enabled and saves both preferences');
  await ev('document.querySelector(\'[data-act="music"][data-arg="0"]\').click()');
  ok(await ev('!HF.musicOn && HF.audio.timer === null && HFX.loadProfile().music === 0'),
    'turning music off stops the scheduler and persists the setting');
  await ev('document.querySelector(\'[data-act="sound"][data-arg="1"]\').click()');
  ok(await ev('HF.soundOn && !HF.musicOn'), 'effects can play while music stays off');
  await ev('HF.ui.dbg.close()');

  /* ---------- gameplay through the real UI ---------- */
  console.log('\n== gameplay through the UI ==');
  await ev('HF.ui.dbg.start(0,"normal")');
  await sleep(700);
  const st1 = JSON.parse(await ev('JSON.stringify(HF.ui.dbg.state())'));
  ok(st1.units === 10, 'stage 1 starts with 10 units', JSON.stringify(st1));
  ok(await ev('!document.getElementById("modal").classList.contains("on")'), 'sheet closed when playing');
  await shot('03-game-start-desktop');

  console.log('\n== terrain and unit identification ==');
  ok(await ev('(function(){var u=HF.ui.st.units[0];HF.ui.selectUnit(u);' +
    'var p=document.getElementById("panel"),d=HF.UNITS[u.t],t=HF.TERR[HF.ui.st.cells[u.i].t];' +
    'return p.querySelector(".unitcode").textContent===d.s&&p.innerText.indexOf(HF.L(t.n))>=0&&p.innerText.indexOf(HF.L(t.d))>=0;})()'),
    'selected unit panel identifies both unit code and terrain');
  ok(await ev('(function(){HF.ui.clearSel();var s=HF.ui.st;' +
    'var i=s.cells.findIndex(function(c,n){return !s.occ[n]&&!(c.own===0&&HF.TERR[c.t].build);});' +
    'HF.ui.tapHex(i);var t=HF.TERR[s.cells[i].t],p=document.getElementById("panel");' +
    'var good=p.innerText.indexOf(HF.L(t.n))>=0&&p.innerText.indexOf("DEF+")>=0&&p.innerText.indexOf("NaN")<0;' +
    'HF.lang="en";HF.ui.applyLang();good=good&&HF.ui.infoCell===i&&p.innerText.indexOf(t.n.en)>=0;' +
    'HF.lang="ja";HF.ui.applyLang();HF.ui.clearSel();return good;})()'),
    'terrain inspection shows valid costs and survives a language change');
  ok(await ev('(function(){var v=HF.view,s=HF.ui.st,g=v.ctx,old=g.fillText,cam={x:v.cam.x,y:v.cam.y,R:v.cam.R};' +
    'var expected=s.units.map(function(u){return HF.UNITS[u.t].s;});' +
    'try{return [8,24].every(function(r){var seen=[];v.cam.R=r;v.snap(s);' +
    'g.fillText=function(text){seen.push(text);return old.apply(this,arguments);};v.draw(s,HF.ui);g.fillText=old;' +
    'return expected.every(function(code){return seen.filter(function(x){return x===code;}).length>=expected.filter(function(x){return x===code;}).length;});});}' +
    'finally{g.fillText=old;v.cam.x=cam.x;v.cam.y=cam.y;v.cam.R=cam.R;v.dirtyTerr=true;}})()'),
    'all friendly and enemy unit codes render at both minimum and normal zoom');
  const terrainVisuals = await ev('(function(){var v=HF.view,s=HF.newGame(0,"normal"),canvas=document.createElement("canvas");' +
    'canvas.width=320;canvas.height=240;var old={ctx:v.ctx,w:v.w,h:v.h,dpr:v.dpr,x:v.cam.x,y:v.cam.y,R:v.cam.R};' +
    's.units=[];s.occ.fill(0);var i=HF.idx(s,4,4);s.cells[i].prop=false;s.cells[i].own=-1;' +
    'try{v.ctx=canvas.getContext("2d");v.w=320;v.h=240;v.dpr=1;v.cam.x=0;v.cam.y=0;v.cam.R=20;' +
    'function pixels(type,theme){s.cells[i].t=type;s.theme=theme;v.dirtyTerr=true;v.draw(s,null);var p=v.hexXY(s,i);' +
    'return Array.from(v.ctx.getImageData(Math.round(p[0]-12),Math.round(p[1]-12),24,24).data).join(",");}' +
    'var images=HF.TKEYS.map(function(t){return pixels(t,"plain");});' +
    'return {count:new Set(images).size,total:images.length,theme:images[0]!==pixels(HF.TKEYS[0],"desert")};}' +
    'finally{v.ctx=old.ctx;v.w=old.w;v.h=old.h;v.dpr=old.dpr;v.cam.x=old.x;v.cam.y=old.y;v.cam.R=old.R;v.dirtyTerr=true;}})()');
  ok(terrainVisuals.count === terrainVisuals.total && terrainVisuals.theme,
    'every terrain type and the desert theme have distinct rendered pixels', JSON.stringify(terrainVisuals));

  const moved = await ev('(function(){var s=HF.ui.st;' +
    'var u=s.units.filter(function(x){return x.side===0;})[0];' +
    'HF.ui.selectUnit(u);' +
    'var ms=HF.ui.moveSet;if(!ms)return "no moveSet";' +
    'var far=-1,best=-1;' +
    'for(var i=0;i<ms.length;i++){if(ms[i]&&HF.distIdx(s,u.i,i)>best){best=HF.distIdx(s,u.i,i);far=i;}}' +
    'var from=u.i;HF.ui.tapHex(far);' +
    'return JSON.stringify({moved:from!==u.i,acted:u.acted,cost:best});})()');
  ok(moved && JSON.parse(moved).moved, 'tap-to-move works through the UI', moved);
  await settle();
  await shot('04-after-move-desktop');

  /* march the nearest unit into contact, then shoot with the forecast sheet */
  const approach = '(function(){' +
    'var s=HF.ui.st;if(!s||s.over)return "over";' +
    'var mine=s.units.filter(function(u){return u.side===0&&u.hp>0&&HF.canAct(s,u);});' +
    'var foes=s.units.filter(function(u){return u.side===1&&u.hp>0;});' +
    'if(!mine.length||!foes.length)return "nobody";' +
    'var best=null;' +
    'for(var a=0;a<mine.length;a++)for(var b=0;b<foes.length;b++){' +
    'var d=HF.distIdx(s,mine[a].i,foes[b].i);if(!best||d<best.d)best={u:mine[a],f:foes[b],d:d};}' +
    'HF.ui.clearSel();HF.ui.selectUnit(best.u);' +
    'var D=HF.UNITS[best.u.t],set=HF.ui.atkSet;' +
    'if(best.d>=D.r0&&best.d<=D.r1&&set&&set[best.f.i])return "inrange";' +
    'var ms=HF.ui.moveSet,bh=-1,bd=1e9;' +
    'for(var i=0;i<ms.length;i++){if(!ms[i])continue;var dd=HF.distIdx(s,i,best.f.i);if(dd<bd){bd=dd;bh=i;}}' +
    'if(bh<0)return "stuck";HF.ui.tapHex(bh);return "gap:"+bd;})()';
  let gapTurns = 0, inRange = false, last = '';
  for (let k = 0; k < 6; k++) {
    last = await ev(approach);
    if (last === 'inrange') { inRange = true; break; }
    if (last === 'over' || last === 'nobody' || last === 'stuck') break;
    gapTurns++;
    await ev('HF.ui.dbg.end()');
    if (!await settle(25000)) { ok(false, 'queue drained while marching', last); break; }
  }
  ok(inRange, 'units march into contact in ' + gapTurns + ' turns', 'last=' + last);
  await shot('05-in-contact-desktop');

  const fired = await ev('(function(){var s=HF.ui.st;' +
    'var mine=s.units.filter(function(u){return u.side===0&&u.hp>0&&!u.attacked;});' +
    'for(var a=0;a<mine.length;a++){' +
    'HF.ui.clearSel();HF.ui.selectUnit(mine[a]);' +
    'var set=HF.ui.atkSet;if(!set)continue;' +
    'for(var j=0;j<set.length;j++) if(set[j]&&s.occ[j]){' +
    'HF.ui.tapHex(j);' +
    'return JSON.stringify({open:document.getElementById("modal").classList.contains("on"),' +
    'kind:document.getElementById("modal").dataset.kind,txt:document.getElementById("sheet").innerText.slice(0,80)});}}' +
    'return JSON.stringify({open:false,kind:"none"});})()');
  const fr = JSON.parse(fired || '{}');
  ok(fr.open === true && fr.kind === 'fire', 'firing opens the forecast sheet', fired);
  await shot('06-fire-forecast-desktop');
  const didFire = await ev('(function(){var b=document.querySelector(\'#sheet [data-act="fire"]\');' +
    'if(!b)return "no fire button";b.click();return "clicked";})()');
  ok(didFire === 'clicked', 'forecast sheet offers a FIRE confirmation');
  await settle(15000);
  console.log('  after firing: ' + await ev('JSON.stringify(HF.ui.st.ko)'));
  await ev('HF.ui.dbg.close();HF.ui.clearSel();');

  const turnBefore = await ev('HF.ui.st.turn');
  await ev('HF.ui.dbg.end()');
  ok(await settle(25000), 'animation queue drains after the AI turn');
  const turnAfter = await ev('HF.ui.st.turn');
  ok(turnAfter > turnBefore, 'turn advanced ' + turnBefore + ' -> ' + turnAfter);
  await shot('07-after-ai-turn-desktop');

  ok(await ev('(function(){HF.ui.undo();return !!HF.ui.st;})()'), 'undo keeps a playable state');
  ok(await ev('HF.ui.dbg.save()') === 'ok', 'save writes to localStorage');
  const savedSize = await ev('(localStorage.getItem(HF.SAVE_KEY)||"").length');
  ok(savedSize > 500, 'save payload size ' + savedSize + ' bytes');

  /* ---------- reload + resume ---------- */
  const savedTurn = await ev('HF.ui.st.turn');
  await go(FILE_URL);
  await sleep(800);
  ok(await ev('!!document.querySelector(\'#sheet [data-act="resume"]\')'), 'title offers CONTINUE after a reload');
  await ev('document.querySelector(\'#sheet [data-act="resume"]\').click()');
  await sleep(800);
  ok(await ev('!!HF.ui.st'), 'resume restores a game');
  const resumedTurn = await ev('HF.ui.st.turn');
  ok(resumedTurn >= savedTurn, 'resumed at the saved turn', resumedTurn + ' >= ' + savedTurn);

  console.log('\n== long run through the UI ==');
  const rr = JSON.parse(await ev('JSON.stringify(HF.ui.dbg.autoTurns(8))'));
  ok(rr.turn >= 8, 'autoTurns advanced to turn ' + rr.turn);
  await shot('08-late-game-desktop');

  /* ---------- phone / tablet landscape ---------- */
  console.log('\n== phone landscape ==');
  for (const [w, h] of [[812, 375], [740, 360], [1024, 768]]) {
    await viewport(w, h, true);
    await ev('HF.ui.showTitle()');
    await sleep(400);
    await shot('09-title-' + w + 'x' + h);
    await ev('HF.ui.dbg.start(6,"normal")');
    await sleep(900);
    const M = await ev('(function(){var cv=document.getElementById("cv");' +
      'var t=document.getElementById("top").getBoundingClientRect();' +
      'var b=document.getElementById("bot").getBoundingClientRect();' +
      'var z=document.getElementById("zoom").getBoundingClientRect();' +
      'return {cw:cv.width,iw:innerWidth,ih:innerHeight,topB:t.bottom|0,botT:b.top|0,' +
      'zoomB:z.bottom|0,R:HF.view.cam.R,rmin:HF.view.RMIN,rmax:HF.view.RMAX};})()');
    ok(Math.round(M.cw) >= M.iw, w + 'x' + h + ': canvas fills the width', JSON.stringify(M));
    ok(M.topB < M.botT, w + 'x' + h + ': hud sits above the action bar', M.topB + ' < ' + M.botT);
    ok(M.zoomB < M.botT, w + 'x' + h + ': zoom column clear of the action bar', M.zoomB + ' < ' + M.botT);
    ok(M.R >= M.rmin && M.R <= M.rmax, w + 'x' + h + ': hexes auto-sized (R=' + M.R + ')');
    await sleep(400);
    await shot('10-game-' + w + 'x' + h);
  }

  /* ---------- real finger taps on a phone screen ---------- */
  console.log('\n== finger taps ==');
  await viewport(812, 375, true);
  await cmd('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
  await ev('HF.ui.showTitle()');
  await sleep(300);
  await ev('HF.ui.dbg.start(1,"normal")');
  await sleep(1000);
  const touch = async (type, pts) => {
    await cmd('Input.dispatchTouchEvent', { type, touchPoints: pts });
    await sleep(70);
  };
  const unitTap = JSON.parse(await ev('(function(){var s=HF.ui.st;' +
    'var u=s.units.filter(function(x){return x.side===0;})[0];' +
    'var p=HF.view.screen(s,u.i);' +
    'return JSON.stringify({p:[Math.round(p[0]),Math.round(p[1])],id:u.id});})()'));
  await touch('touchStart', [{ x: unitTap.p[0], y: unitTap.p[1], id: 1 }]);
  await touch('touchEnd', []);
  await sleep(250);
  const gotSel = await ev('HF.ui.selId');
  ok(gotSel === unitTap.id, 'a finger tap on a hex picks that unit', 'wanted ' + unitTap.id + ' got ' + gotSel);
  await shot('10b-finger-select');

  const destTap = JSON.parse(await ev('(function(){var s=HF.ui.st,u=HF.byId(s,HF.ui.selId);' +
    'if(!u)return JSON.stringify({bad:"gone"});' +
    'var ms=HF.ui.moveSet,bh=-1,bd=-1;var inb=function(p){return p[0]>50&&p[0]<innerWidth-50&&p[1]>60&&p[1]<innerHeight-80;};' +
    'for(var i=0;i<ms.length;i++){if(!ms[i]||i===u.i)continue;' +
    'var dd=HF.distIdx(s,u.i,i);if(dd<=bd)continue;' +
    'if(!inb(HF.view.screen(s,i)))continue;bd=dd;bh=i;}' +
    'if(bh<0)return JSON.stringify({bad:"nowhere"});' +
    'var p=HF.view.screen(s,bh);' +
    'return JSON.stringify({p:[Math.round(p[0]),Math.round(p[1])],id:u.id,i:bh});})()'));
  if (destTap.bad) ok(false, 'picked unit had a visible hex to walk to', destTap.bad);
  else {
    await touch('touchStart', [{ x: destTap.p[0], y: destTap.p[1], id: 2 }]);
    await touch('touchEnd', []);
    await settle(8000);
    const nowI = await ev('HF.byId(HF.ui.st,' + destTap.id + ').i');
    ok(nowI === destTap.i, 'a second finger tap orders the move', 'asked ' + destTap.i + ' landed ' + nowI);
    await shot('10c-finger-move');
  }

  /* pinch out first, then drag: panning only makes sense once the map is bigger than the screen */
  const pinchR0 = await ev('HF.view.cam.R');
  await cmd('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 350, y: 200, id: 8 }, { x: 470, y: 200, id: 9 }] });
  for (let d = 0; d < 5; d++) {
    await cmd('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 350 - d * 12, y: 200, id: 8 }, { x: 470 + d * 12, y: 200, id: 9 }] });
    await sleep(40);
  }
  await cmd('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(400);
  const pinchR1 = await ev('HF.view.cam.R');
  ok(pinchR1 > pinchR0, 'pinch out zooms the map in', pinchR0 + ' -> ' + pinchR1);
  await shot('10d-after-pinch');

  const panBefore = await ev('HF.view.cam.x');
  await cmd('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 420, y: 210, id: 7 }] });
  for (let x = 420; x >= 260; x -= 20) {
    await cmd('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: 210, id: 7 }] });
    await sleep(25);
  }
  await cmd('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(350);
  const panAfter = await ev('HF.view.cam.x');
  ok(Math.abs(panAfter - panBefore) > 20, 'dragging with a finger pans the map', panBefore + ' -> ' + panAfter);
  await shot('10e-after-pan');

  /* ---------- portrait warning ---------- */
  console.log('\n== portrait warning ==');
  await viewport(390, 780, true);
  await ev('HF.view.resize()');
  await sleep(500);
  ok(await ev('getComputedStyle(document.getElementById("rotate")).display') === 'flex',
    'rotate-your-phone notice shows in portrait');
  await shot('11-portrait-warning');
  await ev('document.getElementById("rotateGo").click()');
  await sleep(300);
  ok(await ev('getComputedStyle(document.getElementById("rotate")).display') === 'none', 'notice can be dismissed');
  await viewport(1280, 800, false);

  /* ---------- big map stress ---------- */
  console.log('\n== stage 12 on a big map ==');
  await ev('HF.ui.dbg.start(11,"hard")');
  await sleep(1100);
  await shot('12-stage12-big-map');
  await ev('(function(){var s=HF.ui.st;HF.ui.dbg.center(s.units[0].i);})();' +
    'HF.ui.dbg.zoom(2);HF.ui.dbg.zoom(2);');
  await sleep(700);
  const RZ = await ev('HF.view.cam.R');
  ok(RZ >= (await ev('HF.view.RMIN')) && RZ <= (await ev('HF.view.RMAX')), 'zoom stays inside the sane range', 'R=' + RZ);
  await shot('13-stage12-zoomed');
  const t0 = Date.now();
  const big = JSON.parse(await ev('JSON.stringify(HF.ui.dbg.autoTurns(70))'));
  await settle(25000);
  console.log('  stage 12 finished at turn ' + big.turn + ' (' + (big.over && big.over.why) + ') in ' +
    (Date.now() - t0) + 'ms, units left ' + big.units);
  ok(!!big.over, 'stage 12 resolves inside 70 AI turns', JSON.stringify(big.over));
  await sleep(1200);
  ok(await ev('document.getElementById("modal").dataset.kind') === 'result', 'result screen opens on game over');
  await shot('14-stage12-result');
  ok((await ev('HFX.loadProfile().unlocked')) >= 1, 'profile progress persists');
  await ev('HF.ui.showTitle()');
  await sleep(500);
  await shot('15-title-after-game');

  console.log('\n== console hygiene ==');
  ok(pageErrs.length === 0, 'no uncaught page errors', pageErrs.slice(0, 3).join(' | '));
  ok(consoleErrs.length === 0, 'no console errors/warnings', consoleErrs.slice(0, 3).join(' | '));

  console.log('\n----------------------------------------');
  console.log('PASS ' + pass + '  FAIL ' + fail);
  if (fail) console.log(fails.map(x => '  x ' + x).join('\n'));
  try { ws.close(); } catch (e) { }
  if (!process.argv.includes('--keep')) { try { proc.kill(); } catch (e) { } }
  process.exit(fail ? 1 : 0);
}

main().catch(e => { console.log('HARNESS ERROR: ' + e.message + '\n' + e.stack); process.exit(2); });
