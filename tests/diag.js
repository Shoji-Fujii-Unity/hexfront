/* quick CDP diagnostic: load index.html and dump every console/exception message */
'use strict';
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const ROOT = path.join(__dirname, '..');
const PORT = 9351;
const FILE_URL = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/');
const proc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ['--headless=new', '--disable-gpu', '--no-first-run', '--mute-audio', '--window-size=1280,800',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + path.join(require('os').tmpdir(), 'hf-diag'),
    FILE_URL], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  let target = null;
  for (let i = 0; i < 60 && !target; i++) {
    await sleep(300);
    try { const l = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json(); target = l.find(x => x.type === 'page'); } catch (e) { }
  }
  if (!target) { console.log('no target'); proc.kill(); process.exit(1); }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let idc = 0; const pending = new Map();
  ws.onmessage = m => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); return; }
    console.log('EVT ' + msg.method + ' ' + JSON.stringify(msg.params).slice(0, 600));
  };
  const cmd = (method, params) => new Promise(res => { const id = ++idc; pending.set(id, res); ws.send(JSON.stringify({ id, method, params: params || {} })); });
  await cmd('Runtime.enable'); await cmd('Page.enable'); await cmd('Log.enable');
  await sleep(2500);
  for (const expr of ['1+1', 'typeof HF', 'document.title', 'document.scripts.length',
    '(document.scripts[0].textContent||"").length', 'window.HFX?"hfx":"no"']) {
    const r = await cmd('Runtime.evaluate', { expression: expr, returnByValue: true });
    const v = r.result && r.result.result ? r.result.result.value : undefined;
    console.log('EV ' + expr + ' => ' + JSON.stringify(v) +
      (r.exceptionDetails ? ' EXC ' + JSON.stringify(r.exceptionDetails).slice(0, 400) : ''));
  }
  const scr = await cmd('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(__dirname, 'shots', 'diag.png'), Buffer.from(scr.result.data, 'base64'));
  console.log('shot diag.png');
  ws.close(); proc.kill(); process.exit(0);
})();
