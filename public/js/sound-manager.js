class SoundManager {
  constructor() {
    this.ctx = null;
    this.enabled = localStorage.getItem("soundEnabled") === "true";
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
      }
    }

    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem("soundEnabled", this.enabled);
    return this.enabled;
  }

  blip(freq, dur) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    o.connect(g);
    g.connect(this.ctx.destination);
    g.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.2, this.ctx.currentTime + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + dur);
    o.start();
    o.stop(this.ctx.currentTime + dur);
  }

  playSent() {
    this.blip(832, 0.05);
  }

  playReceived() {
    this.blip(624, 0.05);
  }

  playWhisper() {
    this.blip(1872, 1.5);
  }
}

window.SoundManager = new SoundManager();
