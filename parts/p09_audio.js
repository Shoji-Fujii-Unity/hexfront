/* ===== HEXFRONT :: synthesized music and sound effects (no files) ===== */
(function () {
  var A = HF.audio = { ctx: null, master: null, musicGain: null, timer: null, voices: [], next: 0, step: 0, reported: false };

  function audioError(error) {
    if (A.reported) return;
    A.reported = true;
    console.warn('HEXFRONT audio unavailable:', error);
    if (HF.ui && HF.ui.el.toast) HF.ui.toast(HF.T('set.audioerror'));
  }

  function musicNote(freq, at, duration, volume, type) {
    var o = A.ctx.createOscillator(), g = A.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, at);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(volume, at + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    o.connect(g); g.connect(A.musicGain);
    A.voices.push(o);
    o.onended = function () {
      var index = A.voices.indexOf(o);
      if (index >= 0) A.voices.splice(index, 1);
    };
    o.start(at); o.stop(at + duration + 0.02);
  }

  var chords = [
    [110, 164.81, 220, 261.63], [87.31, 130.81, 174.61, 220],
    [98, 146.83, 196, 246.94], [82.41, 123.47, 164.81, 196]
  ];
  var pattern = [0, 2, 1, 3, 0, 2, 3, 1];
  function scheduleMusic() {
    A.timer = null;
    if (!HF.musicOn || !A.ctx || A.ctx.state !== 'running' || document.hidden) return;
    var now = A.ctx.currentTime;
    if (A.next < now) A.next = now + 0.03;
    while (A.next < now + 0.35) {
      var chord = chords[Math.floor(A.step / 8) % chords.length];
      musicNote(chord[pattern[A.step % 8]] * 2, A.next, 0.65, 0.11, 'triangle');
      if (A.step % 8 === 0) musicNote(chord[0], A.next, 2.8, 0.09, 'sine');
      A.next += 0.38;
      A.step++;
    }
    A.timer = setTimeout(scheduleMusic, 120);
  }
  HF.musicPause = function () {
    if (A.timer !== null) clearTimeout(A.timer);
    A.timer = null;
    if (A.musicGain) A.musicGain.gain.setTargetAtTime(0, A.ctx.currentTime, 0.025);
    for (var i = 0; i < A.voices.length; i++) A.voices[i].stop(A.ctx.currentTime + 0.08);
    A.voices = [];
  };
  HF.musicUpdate = function () {
    if (!HF.musicOn || document.hidden) { HF.musicPause(); return; }
    if (!A.ctx) { HF.audioArm(); return; }
    if (A.ctx.state !== 'running') { HF.audioArm(); return; }
    A.musicGain.gain.setTargetAtTime(0.23, A.ctx.currentTime, 0.08);
    if (A.timer === null) { A.next = A.ctx.currentTime + 0.03; scheduleMusic(); }
  };
  HF.audioArm = function () {
    if (!HF.soundOn && !HF.musicOn) return;
    if (!A.ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { audioError('Web Audio is not supported'); return; }
      try {
        A.ctx = new AC();
        A.master = A.ctx.createGain();
        A.master.gain.value = 0.42;
        A.master.connect(A.ctx.destination);
        A.musicGain = A.ctx.createGain();
        A.musicGain.gain.value = 0;
        A.musicGain.connect(A.master);
      } catch (e) { A.ctx = null; audioError(e); return; }
    }
    if (A.ctx.state === 'suspended') {
      A.ctx.resume().then(function () { HF.musicUpdate(); }, audioError);
    } else if (A.ctx.state === 'running') HF.musicUpdate();
    else audioError('AudioContext is ' + A.ctx.state);
  };

  function tone(f0, f1, dur, type, gain, delay) {
    if (!A.ctx) return;
    var t = A.ctx.currentTime + (delay || 0);
    var o = A.ctx.createOscillator(), g = A.ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain || 0.25, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(A.master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  var noiseBuf = null;
  function noise(dur, gain, cutoff, delay) {
    if (!A.ctx) return;
    if (!noiseBuf) {
      noiseBuf = A.ctx.createBuffer(1, A.ctx.sampleRate * 0.7, A.ctx.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    }
    var t = A.ctx.currentTime + (delay || 0);
    var src = A.ctx.createBufferSource(); src.buffer = noiseBuf;
    var f = A.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(cutoff || 900, t);
    f.frequency.exponentialRampToValueAtTime(180, t + dur);
    var g = A.ctx.createGain();
    g.gain.setValueAtTime(gain || 0.3, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    src.connect(f); f.connect(g); g.connect(A.master);
    src.start(t); src.stop(t + dur + 0.02);
  }

  HF.sfx = function (name) {
    if (!HF.soundOn) return;
    HF.audioArm();
    if (!A.ctx || A.ctx.state === 'closed') return;
    switch (name) {
        case 'click': tone(520, 620, 0.05, 'square', 0.14); break;
        case 'select': tone(700, 980, 0.08, 'square', 0.18); break;
        case 'move': tone(380, 250, 0.1, 'triangle', 0.16); tone(300, 220, 0.08, 'triangle', 0.1, 0.06); break;
        case 'pan': tone(220, 210, 0.03, 'sine', 0.05); break;
        case 'fire': noise(0.22, 0.28, 1800); tone(185, 55, 0.2, 'triangle', 0.22); tone(640, 240, 0.045, 'triangle', 0.08); break;
        case 'hit': noise(0.14, 0.2, 1100); tone(155, 75, 0.14, 'triangle', 0.14); break;
        case 'ko': noise(0.48, 0.34, 1600); tone(135, 42, 0.4, 'triangle', 0.26); tone(70, 34, 0.5, 'sine', 0.23, 0.04); break;
        case 'build': tone(420, 520, 0.09, 'square', 0.15); tone(560, 700, 0.09, 'square', 0.15, 0.09); tone(760, 900, 0.12, 'square', 0.16, 0.18); break;
        case 'capture': tone(620, 780, 0.1, 'square', 0.18); tone(880, 1040, 0.14, 'square', 0.18, 0.1); break;
        case 'turn': tone(300, 420, 0.1, 'triangle', 0.14); tone(420, 300, 0.1, 'triangle', 0.12, 0.1); break;
        case 'deny': tone(190, 120, 0.16, 'sawtooth', 0.16); break;
        case 'win': [523, 659, 784, 1046, 1318].forEach(function (f, i) { tone(f, f, 0.2, 'square', 0.2, i * 0.13); }); break;
        case 'lose': [523, 415, 349, 262].forEach(function (f, i) { tone(f, f * 0.98, 0.26, 'triangle', 0.2, i * 0.17); }); break;
        default: tone(440, 440, 0.05, 'sine', 0.1);
    }
  };
})();
