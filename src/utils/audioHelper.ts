export class AudioHelper {
  private ctx: AudioContext | null = null;

  private init() {
    if (this.ctx) return;
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
    if (!this.ctx) return false;
    if (this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
        return (this.ctx.state as string) === 'running';
      } catch (e) {
        console.warn('Failed to resume AudioContext:', e);
        return false;
      }
    }
    return true;
  }

  play(type: 'success' | 'undo' | 'reveal' | 'winner') {
    this.init();
    const ctx = this.ctx;
    if (!ctx) return;

    // Try to resume if suspended (during interaction)
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    try {
      if (type === 'success') {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);
        
        osc1.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc2.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
        
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        
        osc1.start();
        osc2.start();
        
        setTimeout(() => {
          try {
            osc1.stop();
            osc2.stop();
          } catch (e) {}
        }, 400);
      } else if (type === 'undo') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.frequency.setValueAtTime(392.00, ctx.currentTime); // G4
        osc.frequency.exponentialRampToValueAtTime(261.63, ctx.currentTime + 0.35); // C4
        
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        
        osc.start();
        setTimeout(() => {
          try {
            osc.stop();
          } catch (e) {}
        }, 400);
      } else if (type === 'reveal') {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);
        
        osc1.frequency.setValueAtTime(349.23, ctx.currentTime); // F4
        osc1.frequency.exponentialRampToValueAtTime(523.25, ctx.currentTime + 0.4); // C5
        osc2.frequency.setValueAtTime(440.00, ctx.currentTime); // A4
        osc2.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.4); // E5
        
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        
        osc1.start();
        osc2.start();
        setTimeout(() => {
          try {
            osc1.stop();
            osc2.stop();
          } catch (e) {}
        }, 450);
      } else if (type === 'winner') {
        const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
        notes.forEach((freq, index) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          
          osc.frequency.setValueAtTime(freq, ctx.currentTime + index * 0.1);
          gain.gain.setValueAtTime(0, ctx.currentTime);
          gain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + index * 0.1 + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + index * 0.1 + 0.8);
          
          osc.start(ctx.currentTime + index * 0.1);
          setTimeout(() => {
            try {
              osc.stop();
            } catch (e) {}
          }, 1000 + index * 100);
        });
      }
    } catch (e) {
      console.warn("Audio playing tone failed:", e);
    }
  }

  private bgOscs: OscillatorNode[] = [];
  private bgGain: GainNode | null = null;
  private bgInterval: number | null = null;
  private isBgPlaying = false;

  startBackgroundMusic() {
    this.init();
    const ctx = this.ctx;
    if (!ctx || this.isBgPlaying) return;

    this.isBgPlaying = true;
    this.bgGain = ctx.createGain();
    this.bgGain.connect(ctx.destination);
    this.bgGain.gain.setValueAtTime(0.025, ctx.currentTime); // Soft atmospheric volume

    let step = 0;
    
    // Tense, dark minor chords (D minor / Bb/D dramatic shifts)
    const chords = [
      [146.83, 174.61, 220.00], // D3, F3, A3 (Dm - Suspense root)
      [146.83, 174.61, 233.08], // D3, F3, Bb3 (Bb/D - Rising tension)
      [138.59, 164.81, 207.65], // C#3, E3, G#3 (C#m - Dissonant shift)
      [130.81, 155.56, 196.00]  // Cm - Heavy dramatic resolution
    ];
    let currentChordIndex = 0;

    const playStep = () => {
      if (!this.isBgPlaying || !this.ctx) return;
      
      const currentTime = this.ctx.currentTime;

      // 1. Clock Tick (Triangle, very short high-pitch transient)
      if (step % 2 === 0) {
        const tickOsc = this.ctx.createOscillator();
        const tickGain = this.ctx.createGain();
        tickOsc.type = 'triangle';
        tickOsc.frequency.setValueAtTime(1000, currentTime);
        tickOsc.connect(tickGain);
        if (this.bgGain) tickGain.connect(this.bgGain);
        
        tickGain.gain.setValueAtTime(0.04, currentTime);
        tickGain.gain.exponentialRampToValueAtTime(0.001, currentTime + 0.03);
        
        tickOsc.start(currentTime);
        tickOsc.stop(currentTime + 0.04);
      }

      // 2. Deep Heartbeat Thump (Double low-pitch thump: lub-dub)
      if (step % 4 === 0) {
        const thump = (delay: number) => {
          if (!this.ctx) return;
          const t = this.ctx.currentTime + delay;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          
          osc.type = 'sine';
          osc.frequency.setValueAtTime(58, t); // Very low G1/A1 pitch
          osc.frequency.exponentialRampToValueAtTime(35, t + 0.12);
          
          osc.connect(gain);
          if (this.bgGain) gain.connect(this.bgGain);
          
          gain.gain.setValueAtTime(0.4, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
          
          osc.start(t);
          osc.stop(t + 0.18);
        };
        
        thump(0);
        thump(0.12); // Double thump offset
      }

      // 3. Cinematic Swelling Minor Pads (Triggered every 8 steps)
      if (step % 8 === 0) {
        const chord = chords[currentChordIndex];
        chord.forEach((freq, idx) => {
          if (!this.ctx) return;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          
          osc.type = 'triangle';
          // Detune slightly for tension chorus effect
          osc.frequency.setValueAtTime(freq + (idx === 1 ? 0.6 : -0.6), currentTime);
          
          osc.connect(gain);
          if (this.bgGain) gain.connect(this.bgGain);
          
          gain.gain.setValueAtTime(0, currentTime);
          gain.gain.linearRampToValueAtTime(0.14, currentTime + 0.8);
          gain.gain.exponentialRampToValueAtTime(0.001, currentTime + 2.3);
          
          osc.start(currentTime);
          osc.stop(currentTime + 2.4);
        });

        currentChordIndex = (currentChordIndex + 1) % chords.length;
      }

      step++;
    };

    // Play suspense step every 300ms
    this.bgInterval = window.setInterval(playStep, 300);
  }

  stopBackgroundMusic() {
    this.isBgPlaying = false;
    if (this.bgInterval) {
      clearInterval(this.bgInterval);
      this.bgInterval = null;
    }
    if (this.bgGain) {
      try {
        this.bgGain.disconnect();
      } catch (e) {}
      this.bgGain = null;
    }
  }
}

export const audioHelper = new AudioHelper();
