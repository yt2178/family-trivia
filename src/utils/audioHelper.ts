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
}

export const audioHelper = new AudioHelper();
