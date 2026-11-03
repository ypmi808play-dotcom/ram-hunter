type Sound =
  | 'jump'
  | 'collect'
  | 'shutdown'
  | 'hurt'
  | 'build'
  | 'fanfare'
  | 'enter'
  | 'step'
  | 'crouchStep'
  | 'chip'
  | 'stun'
  | 'hallucination'
  | 'investment'
  | 'agi'
  | 'denied'
  | 'alert'
  | 'hit'
  | 'knockout'
  | 'heal'
  | 'drone'
  | 'terminal'
  | 'jackpot'
  | 'extract'
  | 'suspicious'
  | 'spotted'
  | 'windup'
  | 'emp';

class AudioEngine {
  private context?: AudioContext;
  private master?: GainNode;
  private nextBeat = 0;
  private beat = 0;
  private mode = 'title';
  private paused = false;
  muted = false;

  async unlock() {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.muted ? 0 : 0.22;
      this.master.connect(this.context.destination);
    }
    if (this.context.state === 'suspended') await this.context.resume();
  }
  toggleMute() {
    this.muted = !this.muted;
    this.applyVolume();
    return this.muted;
  }
  setPaused(paused: boolean) { this.paused = paused; this.applyVolume(); }
  private applyVolume() {
    if (this.master && this.context) this.master.gain.setTargetAtTime(this.muted || this.paused ? 0 : 0.22, this.context.currentTime, 0.025);
  }
  setMode(mode: 'title' | 'play' | 'result') {
    this.mode = mode; this.beat = 0; this.nextBeat = this.context?.currentTime ?? 0;
    this.setPaused(false);
  }
  private note(freq: number, duration: number, at = 0, volume = 0.13, type: OscillatorType = 'square', endFreq?: number) {
    if (!this.context || !this.master || this.context.state !== 'running' || this.muted || this.paused) return;
    const t = this.context.currentTime + at;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, t);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t + duration);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain); gain.connect(this.master); osc.start(t); osc.stop(t + duration + 0.02);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }
  tick() {
    if (!this.context || this.paused || this.muted || this.mode === 'result') return;
    const now = this.context.currentTime;
    if (this.nextBeat < now - 0.2) this.nextBeat = now;
    if (this.nextBeat > now + 0.05) return;
    const at = Math.max(0, this.nextBeat - now);
    const melody = [72, 0, 76, 79, 0, 76, 74, 0, 72, 79, 81, 0, 79, 76, 74, 67];
    const bass = [48, 48, 53, 55];
    const n = melody[this.beat % melody.length];
    if (n) this.note(440 * 2 ** ((n - 69) / 12), 0.11, at, this.mode === 'play' ? 0.055 : 0.035, 'triangle');
    if (this.beat % 4 === 0) this.note(440 * 2 ** ((bass[Math.floor(this.beat / 4) % 4] - 69) / 12), 0.22, at, 0.085, 'triangle');
    if (this.beat % 2 === 0) this.note(92, 0.045, at, 0.045, 'square', 40);
    this.nextBeat += this.mode === 'play' ? 0.15 : 0.19; this.beat++;
  }
  play(sound: Sound, size = 16) {
    if (sound === 'hit') { this.note(310, .055, 0, .12, 'square', 120); this.note(780, .045, .025, .06); }
    if (sound === 'knockout') [440, 330, 220, 110].forEach((f, i) => this.note(f, .13, i * .055, .09, 'triangle'));
    if (sound === 'heal') [523, 659, 784, 1047].forEach((f, i) => this.note(f, .17, i * .08, .1, 'triangle'));
    if (sound === 'drone') this.note(420, .12, 0, .045, 'triangle', 260);
    if (sound === 'chip') this.note(730, 0.09, 0, 0.12, 'square', 250);
    if (sound === 'stun') [880, 1108, 740].forEach((f, i) => this.note(f, 0.07, i * 0.04, 0.07));
    if (sound === 'hallucination') [440, 622, 466, 830, 554].forEach((f, i) => this.note(f, 0.16, i * 0.07, 0.09, 'triangle', f * 0.65));
    if (sound === 'investment') [659, 784, 1047].forEach((f, i) => this.note(f, 0.13, i * 0.075, 0.1, 'triangle'));
    if (sound === 'agi') [262, 392, 523, 659, 784, 1047, 1568, 2093].forEach((f, i) => { this.note(f, 0.3, i * 0.055, 0.09); this.note(f / 2, 0.34, i * 0.055, 0.1, 'triangle'); });
    if (sound === 'denied') this.note(130, 0.1, 0, 0.07, 'triangle', 100);
    if (sound === 'alert') { this.note(440, 0.12, 0, 0.06); this.note(587, 0.12, 0.13, 0.06); }
    if (sound === 'suspicious') { this.note(392, 0.08, 0, 0.04, 'triangle', 494); }
    if (sound === 'spotted') { this.note(587, 0.07, 0, 0.08, 'square'); this.note(880, 0.11, 0.06, 0.09, 'square'); }
    if (sound === 'windup') { this.note(280, 0.14, 0, 0.06, 'sawtooth', 520); }
    if (sound === 'emp') { [620, 310, 155].forEach((f, i) => this.note(f, 0.14, i * 0.045, 0.1, 'sawtooth')); }
    if (sound === 'terminal') [659, 880, 1175].forEach((f, i) => this.note(f, 0.1, i * 0.055, 0.08, 'triangle'));
    if (sound === 'jackpot') [523, 659, 784, 1047, 1319, 1568, 2093].forEach((f, i) => this.note(f, 0.18, i * 0.05, 0.12));
    if (sound === 'extract') [392, 523, 659, 784, 1047].forEach((f, i) => this.note(f, 0.16, i * 0.065, 0.1, 'triangle'));
    if (sound === 'jump') this.note(200, 0.13, 0, 0.1, 'square', 650);
    if (sound === 'collect') [523, 659, 784, 1047, ...(size >= 64 ? [1319, 1568] : [])].forEach((f, i) => this.note(f, 0.15, i * 0.055, 0.11));
    if (sound === 'shutdown') this.note(360, 0.24, 0, 0.09, 'sawtooth', 48);
    if (sound === 'hurt') { this.note(170, 0.19, 0, 0.15, 'sawtooth', 65); this.note(130, 0.16, 0.07, 0.12, 'square', 45); }
    if (sound === 'build') { this.note(100, 0.08, 0, 0.12, 'triangle', 55); this.note(260, 0.03, 0.04, 0.04); }
    if (sound === 'enter') [392, 523].forEach((f, i) => this.note(f, 0.09, i * 0.06, 0.07, 'triangle'));
    if (sound === 'step') this.note(70, 0.02, 0, 0.025, 'triangle');
    if (sound === 'crouchStep') this.note(52, 0.015, 0, 0.01, 'triangle');
    if (sound === 'fanfare') [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => { this.note(f, i === 6 ? 0.55 : 0.17, i * 0.12, 0.1); this.note(f / 2, 0.15, i * 0.12, 0.08, 'triangle'); });
  }
}

export const audio = new AudioEngine();
