// Sound effects using Web Audio API with enhanced ambient audio feedback
class SoundEffects {
  private static instance: SoundEffects;
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private reverbNode: ConvolverNode | null = null;
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
      this.masterGain.gain.value = 0.3; // Set default volume
      
      // Create and configure compressor for better dynamics
      this.compressor = this.audioContext.createDynamicsCompressor();
      this.compressor.threshold.value = -24;
      this.compressor.knee.value = 30;
      this.compressor.ratio.value = 12;
      this.compressor.attack.value = 0.003;
      this.compressor.release.value = 0.25;
      
      // Create reverb node for ambient effects
      this.reverbNode = this.audioContext.createConvolver();
      await this.createReverb();
      
      // Connect audio processing chain
      this.masterGain.connect(this.compressor);
      this.compressor.connect(this.reverbNode);
      this.reverbNode.connect(this.audioContext.destination);
      
      console.log('Audio context initialized successfully');
    } catch (error) {
      console.error('Failed to initialize audio context:', error);
    }
  }

  private async createReverb(duration = 2, decay = 0.1) {
    if (!this.audioContext || !this.reverbNode) return;

    const sampleRate = this.audioContext.sampleRate;
    const length = sampleRate * duration;
    const impulse = this.audioContext.createBuffer(2, length, sampleRate);
    
    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - t / duration, decay);
      }
    }
    
    this.reverbNode.buffer = impulse;
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
      attack = 0.02,
      decay = 0.1,
      sustain = 0.7,
      release = 0.1,
      detune = 0
    } = options;

    try {
      const oscillator = this.audioContext!.createOscillator();
      const gainNode = this.audioContext!.createGain();
      
      // Connect the nodes
      oscillator.connect(gainNode);
      gainNode.connect(this.masterGain!);
      
      // Configure oscillator
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, this.audioContext!.currentTime);
      oscillator.detune.setValueAtTime(detune, this.audioContext!.currentTime);
      
      // ADSR envelope
      const now = this.audioContext!.currentTime;
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(1, now + attack);
      gainNode.gain.linearRampToValueAtTime(sustain, now + attack + decay);
      gainNode.gain.linearRampToValueAtTime(sustain, now + duration - release);
      gainNode.gain.linearRampToValueAtTime(0, now + duration);
      
      // Schedule oscillator
      oscillator.start(now);
      oscillator.stop(now + duration);
      
      // Clean up
      return new Promise<void>(resolve => {
        setTimeout(() => {
          oscillator.disconnect();
          gainNode.disconnect();
          resolve();
        }, duration * 1000 + 100);
      });
    } catch (error) {
      console.error('Error playing tone:', error);
    }
  }

  async playWakeWord() {
    // Gentle ascending arpeggio with slight detune for warmth
    await this.playTone(523.25, 0.15, { // C5
      type: 'sine',
      detune: 2,
      attack: 0.02,
      decay: 0.1,
      sustain: 0.8
    });
    await this.playTone(659.25, 0.15, { // E5
      type: 'sine',
      detune: -2,
      attack: 0.02,
      decay: 0.1,
      sustain: 0.8
    });
    await this.playTone(783.99, 0.2, { // G5
      type: 'sine',
      detune: 2,
      attack: 0.02,
      decay: 0.15,
      sustain: 0.9,
      release: 0.15
    });
  }

  async playSuccess() {
    // Warm major seventh chord with subtle variations
    const now = performance.now();
    await Promise.all([
      this.playTone(523.25, 0.4, { // C5
        type: 'sine',
        attack: 0.05,
        sustain: 0.8,
        detune: 2
      }),
      this.playTone(659.25, 0.4, { // E5
        type: 'sine',
        attack: 0.06,
        sustain: 0.7,
        detune: -2
      }),
      this.playTone(783.99, 0.4, { // G5
        type: 'sine',
        attack: 0.07,
        sustain: 0.6,
        detune: 1
      }),
      this.playTone(987.77, 0.4, { // B5
        type: 'sine',
        attack: 0.08,
        sustain: 0.5,
        detune: -1
      })
    ]);
    console.log('Success sound played in:', performance.now() - now, 'ms');
  }

  async playError() {
    // Gentle descending minor third with soft envelope
    await this.playTone(523.25, 0.2, { // C5
      type: 'sine',
      attack: 0.04,
      decay: 0.1,
      sustain: 0.7,
      release: 0.15
    });
    await this.playTone(440.00, 0.3, { // A4
      type: 'sine',
      attack: 0.04,
      decay: 0.15,
      sustain: 0.6,
      release: 0.2
    });
  }

  async playListeningStart() {
    // Bright single tone with quick attack
    await this.playTone(880, 0.15, { // A5
      type: 'sine',
      attack: 0.02,
      decay: 0.05,
      sustain: 0.8,
      release: 0.08,
      detune: 2
    });
  }

  async playListeningStop() {
    // Mellow tone with longer release
    await this.playTone(659.25, 0.2, { // E5
      type: 'sine',
      attack: 0.03,
      decay: 0.1,
      sustain: 0.7,
      release: 0.15,
      detune: -2
    });
  }
}

export const soundEffects = SoundEffects.getInstance();
