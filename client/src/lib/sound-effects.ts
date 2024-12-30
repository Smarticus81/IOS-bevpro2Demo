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

      // Create and configure master gain
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = 0.2; // Reduced overall volume

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
      attack = 0.01,  // Faster attack
      decay = 0.05,   // Faster decay
      sustain = 0.7,
      release = 0.05, // Faster release
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
        }, duration * 1000 + 50); // Reduced cleanup delay
      });
    } catch (error) {
      console.error('Error playing tone:', error);
    }
  }

  async playWakeWord() {
    // Quick ascending arpeggio
    await this.playTone(523.25, 0.08, { // C5
      type: 'sine',
      detune: 2,
      attack: 0.01,
      decay: 0.03,
      sustain: 0.8
    });
    await this.playTone(659.25, 0.08, { // E5
      type: 'sine',
      detune: -2,
      attack: 0.01,
      decay: 0.03,
      sustain: 0.8
    });
  }

  async playSuccess() {
    // Quick major chord
    const now = performance.now();
    await Promise.all([
      this.playTone(523.25, 0.15, { // C5
        type: 'sine',
        attack: 0.02,
        sustain: 0.8,
        detune: 2
      }),
      this.playTone(659.25, 0.15, { // E5
        type: 'sine',
        attack: 0.02,
        sustain: 0.7,
        detune: -2
      }),
      this.playTone(783.99, 0.15, { // G5
        type: 'sine',
        attack: 0.02,
        sustain: 0.6,
        detune: 1
      })
    ]);
    console.log('Success sound played in:', performance.now() - now, 'ms');
  }

  async playError() {
    // Quick descending minor third
    await this.playTone(523.25, 0.1, { // C5
      type: 'sine',
      attack: 0.02,
      decay: 0.05,
      sustain: 0.7,
      release: 0.03
    });
    await this.playTone(440.00, 0.15, { // A4
      type: 'sine',
      attack: 0.02,
      decay: 0.05,
      sustain: 0.6,
      release: 0.05
    });
  }

  async playListeningStart() {
    // Single quick bright tone
    await this.playTone(880, 0.08, { // A5
      type: 'sine',
      attack: 0.01,
      decay: 0.03,
      sustain: 0.8,
      release: 0.04,
      detune: 2
    });
  }

  async playListeningStop() {
    // Quick mellow tone
    await this.playTone(659.25, 0.1, { // E5
      type: 'sine',
      attack: 0.01,
      decay: 0.05,
      sustain: 0.7,
      release: 0.04,
      detune: -2
    });
  }
}

export const soundEffects = SoundEffects.getInstance();