export class AudioHelper {
  private bgAudio: HTMLAudioElement | null = null;
  private correctAudio: HTMLAudioElement | null = null;
  private wrongAudio: HTMLAudioElement | null = null;
  private winAudio: HTMLAudioElement | null = null;
  private suspenseAudio: HTMLAudioElement | null = null;
  private pauseAudio: HTMLAudioElement | null = null;
  private introAudio: HTMLAudioElement | null = null;
  private boomAudio: HTMLAudioElement | null = null;
  private ctx: AudioContext | null = null;
  private isBgPlaying = false;
  private isMuted = false;
  private currentActiveTrack: HTMLAudioElement | null = null;
  private fadeIntervals = new Map<HTMLAudioElement, any>();

  private init() {
    if (this.bgAudio) return;

    // Who Wants to Be a Millionaire — background tension loop
    this.bgAudio = new Audio('https://raw.githubusercontent.com/aaronnech/Who-Wants-to-be-a-Millionaire/master/sound/background.mp3');
    this.bgAudio.loop = true;
    this.bgAudio.volume = 0.55;

    // Correct answer chime
    this.correctAudio = new Audio('https://raw.githubusercontent.com/aaronnech/Who-Wants-to-be-a-Millionaire/master/sound/right.mp3');
    this.correctAudio.volume = 0.65;

    // Wrong answer buzzer
    this.wrongAudio = new Audio('https://raw.githubusercontent.com/aaronnech/Who-Wants-to-be-a-Millionaire/master/sound/wrong.mp3');
    this.wrongAudio.volume = 0.6;

    // Victory applause for end-of-game
    this.winAudio = new Audio('https://raw.githubusercontent.com/techieshruti/Quiz-App-with-Timer/main/sounds/clapping.mp3');
    this.winAudio.volume = 0.75;

    // Kevin MacLeod "Volatile Reaction" — dramatic orchestral suspense for winner reveal countdown
    // License: CC BY 4.0 (incompetech.com)
    this.suspenseAudio = new Audio('https://incompetech.com/music/royalty-free/mp3-royaltyfree/Volatile%20Reaction.mp3');
    this.suspenseAudio.loop = true;
    this.suspenseAudio.volume = 0.7;

    // Kevin MacLeod "Local Forecast - Elevator" — calm elevator music for pause state
    // Kevin MacLeod "Bossa Antigua" — warm acoustic bossa nova for pause state
    // License: CC BY 4.0 (incompetech.com)
    this.pauseAudio = new Audio('https://incompetech.com/music/royalty-free/mp3-royaltyfree/Bossa%20Antigua.mp3');
    this.pauseAudio.loop = true;
    this.pauseAudio.volume = 0.5;
    this.pauseAudio.loop = true;
    this.pauseAudio.volume = 0.5;

    // Who Wants to Be a Millionaire — Let's Play intro music for start countdown
    this.introAudio = new Audio('https://raw.githubusercontent.com/UniPiSSL/quiz-game-demo/main/sounds/lets_play.mp3');
    this.introAudio.volume = 0.65;
    this.introAudio.loop = true;

    // Gong / Cinematic boom sound for start of game (replaces synthesized sawtooth wave)
    this.boomAudio = new Audio('https://raw.githubusercontent.com/QuickBirdEng/survey_kit/main/assets/gong.mp3');
    this.boomAudio.volume = 0.70;

    // Synthesizer context for zero-latency ticking & start-boom
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
    // Unlock HTMLAudio on iOS/Safari
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
    if (this.suspenseAudio) this.suspenseAudio.muted = mute;
    if (this.pauseAudio) this.pauseAudio.muted = mute;
    if (this.introAudio) this.introAudio.muted = mute;
    if (this.boomAudio) this.boomAudio.muted = mute;

    // If unmuting, play the active track if it was paused
    if (!mute && this.currentActiveTrack && this.currentActiveTrack.paused) {
      this.currentActiveTrack.play().catch(e => console.log('Play on unmute failed:', e));
    }
  }

  // Crossfade and volume smoothing transition helper
  private fadeTo(targetAudio: HTMLAudioElement | null, targetVolume: number, duration: number = 800) {
    this.init();

    // 1. If we are fading to the same audio that is already playing, do nothing
    if (this.currentActiveTrack === targetAudio) {
      if (targetAudio && targetAudio.paused && !this.isMuted) {
        targetAudio.volume = targetVolume;
        targetAudio.play().catch(e => console.log('Play failed:', e));
      }
      return;
    }

    const oldAudio = this.currentActiveTrack;
    this.currentActiveTrack = targetAudio;

    const steps = 16;
    const intervalTime = duration / steps;

    // 2. Fade out the old audio
    if (oldAudio) {
      if (this.fadeIntervals.has(oldAudio)) {
        clearInterval(this.fadeIntervals.get(oldAudio));
        this.fadeIntervals.delete(oldAudio);
      }

      let currentVol = oldAudio.volume;
      const volStep = currentVol / steps;

      const fadeOutTimer = setInterval(() => {
        if (oldAudio.volume > volStep) {
          oldAudio.volume = Math.max(0, oldAudio.volume - volStep);
        } else {
          oldAudio.volume = 0;
          oldAudio.pause();
          clearInterval(fadeOutTimer);
          this.fadeIntervals.delete(oldAudio);
        }
      }, intervalTime);

      this.fadeIntervals.set(oldAudio, fadeOutTimer);
    }

    // 3. Fade in the new audio
    if (targetAudio) {
      if (this.fadeIntervals.has(targetAudio)) {
        clearInterval(this.fadeIntervals.get(targetAudio));
        this.fadeIntervals.delete(targetAudio);
      }

      targetAudio.volume = 0;
      targetAudio.muted = this.isMuted;

      if (!this.isMuted) {
        targetAudio.currentTime = 0;
        targetAudio.play().then(() => {
          let currentVol = 0;
          const volStep = targetVolume / steps;

          const fadeInTimer = setInterval(() => {
            if (currentVol < targetVolume) {
              currentVol = Math.min(targetVolume, currentVol + volStep);
              targetAudio.volume = currentVol;
            } else {
              targetAudio.volume = targetVolume;
              clearInterval(fadeInTimer);
              this.fadeIntervals.delete(targetAudio);
            }
          }, intervalTime);

          this.fadeIntervals.set(targetAudio, fadeInTimer);
        }).catch(err => {
          console.log('Fade in play failed:', err);
          targetAudio.volume = targetVolume;
        });
      } else {
        targetAudio.volume = targetVolume;
      }
    }
  }

  // Loop music starters & stoppers with crossfade transitions
  startBackgroundMusic() {
    this.init();
    this.isBgPlaying = true;
    this.fadeTo(this.bgAudio, 0.55);
  }

  stopBackgroundMusic() {
    this.isBgPlaying = false;
    if (this.currentActiveTrack === this.bgAudio) {
      this.fadeTo(null, 0);
    }
  }

  startSuspenseMusic() {
    this.init();
    this.fadeTo(this.suspenseAudio, 0.70);
  }

  stopSuspenseMusic() {
    if (this.currentActiveTrack === this.suspenseAudio) {
      this.fadeTo(null, 0);
    }
  }

  startPauseMusic() {
    this.init();
    this.fadeTo(this.pauseAudio, 0.50);
  }

  stopPauseMusic() {
    if (this.currentActiveTrack === this.pauseAudio) {
      this.fadeTo(null, 0);
    }
  }

  startIntroMusic() {
    this.init();
    this.fadeTo(this.introAudio, 0.65);
  }

  stopIntroMusic() {
    if (this.currentActiveTrack === this.introAudio) {
      this.fadeTo(null, 0);
    }
  }
  
  // ─── Helper method to check if intro is declared ──────────────────────────────
  hasIntroAudio() {
    return !!this.introAudio;
  }

  // ─── One-shot sound effects ───────────────────────────────────────────────
  play(type: 'success' | 'undo' | 'reveal' | 'winner' | 'victory' | 'countdown-tick' | 'game-start-boom') {
    this.init();
    if (this.isMuted) return;

    if (type === 'success' || type === 'reveal') {
      if (this.correctAudio) {
        this.correctAudio.currentTime = 0;
        this.correctAudio.play().catch(e => console.log('Correct sound failed:', e));
      }
    } else if (type === 'undo') {
      if (this.wrongAudio) {
        this.wrongAudio.currentTime = 0;
        this.wrongAudio.play().catch(e => console.log('Wrong sound failed:', e));
      }
    } else if (type === 'victory' || type === 'winner') {
      this.stopSuspenseMusic();
      if (this.winAudio) {
        this.winAudio.currentTime = 0;
        this.winAudio.play().catch(e => console.log('Victory applause failed:', e));
      }
    } else if (type === 'countdown-tick') {
      this.playTick();
    } else if (type === 'game-start-boom') {
      if (this.boomAudio) {
        this.boomAudio.currentTime = 0;
        this.boomAudio.muted = this.isMuted;
        this.boomAudio.play().catch(e => console.log('Boom sound failed:', e));
      }
    }
  }

  // ─── Synthesized zero-latency effects ────────────────────────────────────
  private playTick() {
    if (!this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, t);
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


}

export const audioHelper = new AudioHelper();
