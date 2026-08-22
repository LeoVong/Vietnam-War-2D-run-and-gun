export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfx: GainNode | null = null;
  private music: GainNode | null = null;
  muted = false;
  private drone: OscillatorNode | null = null;

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC({ latencyHint: "interactive" });
      this.master = this.ctx.createGain();
      this.sfx = this.ctx.createGain();
      this.music = this.ctx.createGain();
      this.sfx.gain.value = 0.7;
      this.music.gain.value = 0.18;
      this.master.gain.value = this.muted ? 0 : 0.85;
      this.sfx.connect(this.master);
      this.music.connect(this.master);
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    this.ensureMusic();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.85, this.ctx.currentTime, 0.03);
    }
  }

  private env(g: GainNode, peak: number, dur: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  private noise(dur: number) {
    if (!this.ctx) return null;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    return src;
  }

  shoot() {
    if (!this.ctx || !this.sfx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(920 + Math.random() * 80, t);
    osc.frequency.exponentialRampToValueAtTime(240, t + 0.07);
    this.env(g, 0.12, 0.08);
    osc.connect(g);
    g.connect(this.sfx);
    osc.start();
    osc.stop(t + 0.09);
    const n = this.noise(0.05);
    if (n) {
      const ng = this.ctx.createGain();
      const f = this.ctx.createBiquadFilter();
      f.type = "highpass";
      f.frequency.value = 1800;
      this.env(ng, 0.08, 0.05);
      n.connect(f);
      f.connect(ng);
      ng.connect(this.sfx);
      n.start();
    }
  }

  explode(big = false) {
    if (!this.ctx || !this.sfx) return;
    const n = this.noise(big ? 0.45 : 0.28);
    if (!n) return;
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = big ? 480 : 720;
    this.env(g, big ? 0.45 : 0.28, big ? 0.45 : 0.26);
    n.connect(f);
    f.connect(g);
    g.connect(this.sfx);
    n.start();
  }

  jump() {
    if (!this.ctx || !this.sfx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(420, t + 0.12);
    this.env(g, 0.1, 0.14);
    osc.connect(g);
    g.connect(this.sfx);
    osc.start();
    osc.stop(t + 0.15);
  }

  hit() {
    if (!this.ctx || !this.sfx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.16);
    this.env(g, 0.16, 0.18);
    osc.connect(g);
    g.connect(this.sfx);
    osc.start();
    osc.stop(t + 0.2);
  }

  pickup() {
    if (!this.ctx || !this.sfx) return;
    const ctx = this.ctx;
    const sfx = this.sfx;
    const t = ctx.currentTime;
    [520, 780].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = f;
      this.env(g, 0.1, 0.12);
      osc.connect(g);
      g.connect(sfx);
      osc.start(t + i * 0.06);
      osc.stop(t + 0.18 + i * 0.06);
    });
  }

  land() {
    if (!this.ctx || !this.sfx) return;
    const n = this.noise(0.08);
    if (!n) return;
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 400;
    this.env(g, 0.12, 0.08);
    n.connect(f);
    f.connect(g);
    g.connect(this.sfx);
    n.start();
  }

  ui() {
    if (!this.ctx || !this.sfx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = 660;
    this.env(g, 0.08, 0.08);
    osc.connect(g);
    g.connect(this.sfx);
    osc.start();
    osc.stop(t + 0.1);
  }

  private ensureMusic() {
    if (!this.ctx || !this.music || this.drone) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 55;
    g.gain.value = 0.35;
    const lfo = this.ctx.createOscillator();
    const lg = this.ctx.createGain();
    lfo.frequency.value = 0.12;
    lg.gain.value = 6;
    lfo.connect(lg);
    lg.connect(osc.frequency);
    osc.connect(g);
    g.connect(this.music);
    osc.start();
    lfo.start();
    this.drone = osc;
    const hat = () => {
      if (!this.ctx || !this.music || this.muted) return;
      const n = this.noise(0.04);
      if (!n) return;
      const hg = this.ctx.createGain();
      const f = this.ctx.createBiquadFilter();
      f.type = "highpass";
      f.frequency.value = 5000;
      this.env(hg, 0.04, 0.04);
      n.connect(f);
      f.connect(hg);
      hg.connect(this.music);
      n.start();
    };
    window.setInterval(hat, 720);
  }
}
