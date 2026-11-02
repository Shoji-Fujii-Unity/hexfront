/* Web Audio scheduling and profile compatibility without a browser. */
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const timers = new Map();
let nextTimer = 1;
const starts = [];
class Param {
  constructor() { this.value = 0; this.targets = []; }
  setValueAtTime(value) { this.value = value; }
  linearRampToValueAtTime(value) { this.value = value; }
  exponentialRampToValueAtTime(value) { this.value = value; }
  setTargetAtTime(value) { this.value = value; this.targets.push(value); }
}
class Node {
  constructor(kind) { this.kind = kind; this.gain = new Param(); this.frequency = new Param(); }
  connect(node) { this.destination = node; }
  start(time) { starts.push({ kind: this.kind, time }); }
  stop() {}
}
class AudioContext {
  constructor() { this.state = 'running'; this.currentTime = 0; this.sampleRate = 100; this.destination = {}; }
  createGain() { return new Node('gain'); }
  createOscillator() { return new Node('oscillator'); }
  createBufferSource() { return new Node('noise'); }
  createBiquadFilter() { return new Node('filter'); }
  createBuffer(channels, length) { return { getChannelData: () => new Float32Array(length) }; }
  resume() { this.state = 'running'; return Promise.resolve(); }
}
const sandbox = {
  console, Math, JSON, Date, Promise,
  window: { AudioContext },
  document: { hidden: false },
  setTimeout: fn => { const id = nextTimer++; timers.set(id, fn); return id; },
  clearTimeout: id => timers.delete(id)
};
vm.createContext(sandbox);
for (const part of ['p01_core.js', 'p09_audio.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'parts', part), 'utf8'), sandbox, { filename: part });
}
const HF = sandbox.HF;

HF.store.set(HF.PROFILE_KEY, JSON.stringify({ v: 1, sound: 0 }));
assert.strictEqual(HF.loadProfile().music, 0, 'old muted profiles remain silent');
HF.store.set(HF.PROFILE_KEY, JSON.stringify({ v: 1, sound: 1 }));
assert.strictEqual(HF.loadProfile().music, 1, 'old unmuted profiles enable music');
HF.store.set(HF.PROFILE_KEY, JSON.stringify({ v: 1, sound: 0, music: 1 }));
assert.strictEqual(HF.loadProfile().music, 1, 'independent music setting is preserved');

HF.soundOn = false;
HF.musicOn = true;
HF.audioArm();
assert.ok(HF.audio.ctx, 'music starts even with effects muted');
assert.ok(starts.length >= 2, 'music schedules melody and bass');
assert.strictEqual(timers.size, 1, 'one music scheduler is active');
HF.audioArm();
assert.strictEqual(timers.size, 1, 'repeated gestures do not duplicate the scheduler');
const beforeMutedEffect = starts.length;
HF.sfx('fire');
assert.strictEqual(starts.length, beforeMutedEffect, 'effects respect their independent mute');

HF.musicOn = false;
HF.musicUpdate();
assert.strictEqual(timers.size, 0, 'turning music off stops scheduling');
assert.strictEqual(HF.audio.musicGain.gain.value, 0, 'turning music off fades the music bus');
assert.strictEqual(HF.audio.voices.length, 0, 'turning music off retires scheduled notes');
HF.soundOn = true;
HF.sfx('fire');
assert.ok(starts.length > beforeMutedEffect, 'effects still play when music is off');

HF.musicOn = true;
HF.musicUpdate();
assert.strictEqual(timers.size, 1, 'music can be restarted');
sandbox.document.hidden = true;
HF.musicPause();
assert.strictEqual(timers.size, 0, 'hidden pages stop scheduling');
sandbox.document.hidden = false;
HF.audioArm();
assert.strictEqual(timers.size, 1, 'music resumes after returning');
HF.musicPause();
HF.audio.ctx.state = 'suspended';
HF.musicUpdate();
assert.strictEqual(HF.audio.ctx.state, 'running', 'enabling music resumes a suspended context');
Promise.resolve().then(() => {
  assert.strictEqual(timers.size, 1, 'music starts after the suspended context resumes');
  HF.musicPause();
  console.log('Audio scheduling and profile tests passed.');
}).catch(error => { console.error(error); process.exitCode = 1; });
