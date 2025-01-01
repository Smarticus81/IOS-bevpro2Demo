// Sound effects using Web Audio API with enhanced ambient audio feedback
class SoundEffects {
  private static instance: SoundEffects;
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;

  private constructor() {
    // Initialize on first user interaction to comply with autoplay policies
    document.addEventListener('click', () => {
      if (!this.audioContext) {
        this.initAudioContext();
      }
    }, { once: true });
  }

  private async initAudioContext() {
    try {
      this.audioContext = new AudioContext();

      // Create and configure master gain with lower volume
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = 0.12; // Reduced overall volume

      // Create and configure compressor for better dynamics
      this.compressor = this.audioContext.createDynamicsCompressor();
      this.compressor.threshold.value = -24;
      this.compressor.knee.value = 30;
      this.compressor.ratio.value = 12;
      this.compressor.attack.value = 0.003;
      this.compressor.release.value = 0.25;

      // Connect audio processing chain
      this.masterGain.connect(this.compressor);
      this.compressor.connect(this.audioContext.destination);

      console.log('Audio context initialized successfully');
    } catch (error) {
      console.error('Failed to initialize audio context:', error);
    }
  }

  static getInstance(): SoundEffects {
    if (!SoundEffects.instance) {
      SoundEffects.instance = new SoundEffects();
    }
    return SoundEffects.instance;
  }

  private async playTone(
    frequency: number,
    duration: number,
    options: {
      type?: OscillatorType;
      attack?: number;
      decay?: number;
      sustain?: number;
      release?: number;
      detune?: number;
    } = {}
  ) {
    if (!this.audioContext || !this.masterGain) {
      await this.initAudioContext();
    }

    const {
      type = 'sine',
      attack = 0.01,
      decay = 0.03,
      sustain = 0.7,
      release = 0.03,
      detune = 0
    } = options;

    try {
      const oscillator = this.audioContext!.createOscillator();
      const gainNode = this.audioContext!.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.masterGain!);

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, this.audioContext!.currentTime);
      oscillator.detune.setValueAtTime(detune, this.audioContext!.currentTime);

      const now = this.audioContext!.currentTime;
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(1, now + attack);
      gainNode.gain.linearRampToValueAtTime(sustain, now + attack + decay);
      gainNode.gain.linearRampToValueAtTime(sustain, now + duration - release);
      gainNode.gain.linearRampToValueAtTime(0, now + duration);

      oscillator.start(now);
      oscillator.stop(now + duration);

      return new Promise<void>(resolve => {
        setTimeout(() => {
          oscillator.disconnect();
          gainNode.disconnect();
          resolve();
        }, duration * 1000 + 20); // Minimal cleanup delay
      });
    } catch (error) {
      console.error('Error playing tone:', error);
    }
  }

  async playWakeWord() {
    // Pleasant ascending major third
    await this.playTone(440, 0.08, { // A4
      type: 'sine',
      attack: 0.02,
      decay: 0.01,
      sustain: 0.8,
      release: 0.02
    });
    await this.playTone(554.37, 0.1, { // C#5
      type: 'sine',
      attack: 0.01,
      decay: 0.02,
      sustain: 0.7,
      release: 0.03
    });
  }

  async playSuccess() {
    // Pleasant major chord with slight arpeggio
    await Promise.all([
      this.playTone(440.00, 0.15, { // A4
        type: 'sine',
        attack: 0.02,
        sustain: 0.8,
      }),
      this.playTone(554.37, 0.15, { // C#5
        type: 'sine',
        attack: 0.03,
        sustain: 0.7,
        detune: -2
      }),
      this.playTone(659.25, 0.15, { // E5
        type: 'sine',
        attack: 0.04,
        sustain: 0.6,
        detune: 2
      })
    ]);
  }

  async playListeningStart() {
    // Single gentle tone
    await this.playTone(554.37, 0.08, { // C#5
      type: 'sine',
      attack: 0.02,
      decay: 0.01,
      sustain: 0.8,
      release: 0.02
    });
  }

  async playListeningStop() {
    // Gentle descending tone
    await this.playTone(440.00, 0.1, { // A4
      type: 'sine',
      attack: 0.02,
      decay: 0.02,
      sustain: 0.7,
      release: 0.03
    });
  }
}

export const soundEffects = SoundEffects.getInstance();