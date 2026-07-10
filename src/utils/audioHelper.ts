export class AudioHelper {
  private bgAudio: HTMLAudioElement | null = null;
  private correctAudio: HTMLAudioElement | null = null;
  private wrongAudio: HTMLAudioElement | null = null;
  private winAudio: HTMLAudioElement | null = null;
  private ctx: AudioContext | null = null;
  private isBgPlaying = false;
  private isMuted = false;

  private init() {
    if (this.bgAudio) return;

    // Load actual high-quality Who Wants to Be a Millionaire audio files (CORS-friendly raw Git content)
    this.bgAudio = new Audio('https://raw.githubusercontent.com/aaronnech/Who-Wants-to-be-a-Millionaire/master/sound/background.mp3');
    this.bgAudio.loop = true;
    this.bgAudio.volume = 0.55; // Audible background music

    this.correctAudio = new Audio('https://raw.githubusercontent.com/aaronnech/Who-Wants-to-be-a-Millionaire/master/sound/right.mp3');
    this.correctAudio.volume = 0.65;

    this.wrongAudio = new Audio('https://raw.githubusercontent.com/aaronnech/Who-Wants-to-be-a-Millionaire/master/sound/wrong.mp3');
    this.wrongAudio.volume = 0.6;

    // Clapping/Cheering sound for final victory celebration
    this.winAudio = new Audio('https://raw.githubusercontent.com/techieshruti/Quiz-App-with-Timer/main/sounds/clapping.mp3');
    this.winAudio.volume = 0.75;

    // Synthesizer context for zero-latency ticking & explosions
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      this.ctx = new AudioContextClass();
    }
  }

  getContext(): AudioContext | null {
    this.init();
    return this.ctx;
  }

  isSuspended(): boolean {
    this.init();
    return this.ctx ? this.ctx.state === 'suspended' : false;
  }

  async resume(): Promise<boolean> {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch (e) {
        console.warn('Failed to resume AudioContext:', e);
      }
    }
    // Also unlock HTMLAudio elements on iOS/Safari by playing & pausing briefly
    if (this.bgAudio) {
      this.bgAudio.play().then(() => this.bgAudio?.pause()).catch(() => {});
    }
    return true;
  }

  setMute(mute: boolean) {
    this.isMuted = mute;
    this.init();
    if (this.bgAudio) this.bgAudio.muted = mute;
    if (this.correctAudio) this.correctAudio.muted = mute;
    if (this.wrongAudio) this.wrongAudio.muted = mute;
    if (this.winAudio) this.winAudio.muted = mute;
  }

  startBackgroundMusic() {
    this.init();
    if (this.isMuted) return;
    this.isBgPlaying = true;
    if (this.bgAudio) {
      this.bgAudio.currentTime = 0;
      this.bgAudio.play().catch(err => console.log('Tension music play failed:', err));
    }
  }

  stopBackgroundMusic() {
    this.isBgPlaying = false;
    if (this.bgAudio) {
      this.bgAudio.pause();
      this.bgAudio.currentTime = 0;
    }
  }

  play(type: 'success' | 'undo' | 'reveal' | 'winner' | 'victory' | 'countdown-tick' | 'game-start-boom') {
    this.init();
    if (this.isMuted) return;

    // Map logic to real sounds
    if (type === 'success' || type === 'reveal') {
      if (this.correctAudio) {
        this.correctAudio.currentTime = 0;
        this.correctAudio.play().catch(e => console.log('Correct sound failed:', e));
      }
    } else if (type === 'undo' || type === 'winner') {
      // Small synthesized buzzer sound or play correct/wrong sound
      if (this.wrongAudio) {
        this.wrongAudio.currentTime = 0;
        this.wrongAudio.play().catch(e => console.log('Wrong sound failed:', e));
      }
    } else if (type === 'victory') {
      if (this.winAudio) {
        this.winAudio.currentTime = 0;
        this.winAudio.play().catch(e => console.log('Victory applause failed:', e));
      }
    } else if (type === 'countdown-tick') {
      this.playTick();
    } else if (type === 'game-start-boom') {
      this.playBoom();
    }
  }

  private playTick() {
    if (!this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, t); // Crisp high-frequency beep
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      
      osc.start(t);
      osc.stop(t + 0.1);
    } catch (e) {
      console.warn('Synthesized tick failed:', e);
    }
  }

  private playBoom() {
    if (!this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      
      // Low frequency rumble sweep
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, t);
      osc.frequency.exponentialRampToValueAtTime(30, t + 0.7);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.85);
      
      osc.start(t);
      osc.stop(t + 0.9);

      // High crash sizzle
      const sizzle = this.ctx.createOscillator();
      const sizzleGain = this.ctx.createGain();
      sizzle.type = 'triangle';
      sizzle.frequency.setValueAtTime(6000, t);
      sizzle.frequency.exponentialRampToValueAtTime(3000, t + 0.3);
      sizzle.connect(sizzleGain);
      sizzleGain.connect(this.ctx.destination);
      
      sizzleGain.gain.setValueAtTime(0.18, t);
      sizzleGain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      
      sizzle.start(t);
      sizzle.stop(t + 0.4);
    } catch (e) {
      console.warn('Synthesized boom failed:', e);
    }
  }
}

export const audioHelper = new AudioHelper();
