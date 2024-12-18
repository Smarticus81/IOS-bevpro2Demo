// Sound effects using Web Audio API
class SoundEffects {
  private static instance: SoundEffects;
  private audioContext: AudioContext | null = null;
  private gainNode: GainNode | null = null;

  private constructor() {
    // Initialize on first user interaction to comply with autoplay policies
    document.addEventListener('click', () => {
      if (!this.audioContext) {
        this.initAudioContext();
      }
    }, { once: true });
  }

  private initAudioContext() {
    this.audioContext = new AudioContext();
    this.gainNode = this.audioContext.createGain();
    this.gainNode.connect(this.audioContext.destination);
    this.gainNode.gain.value = 0.3; // Set default volume
  }

  static getInstance(): SoundEffects {
    if (!SoundEffects.instance) {
      SoundEffects.instance = new SoundEffects();
    }
    return SoundEffects.instance;
  }

  private async playTone(frequency: number, duration: number, type: OscillatorType = 'sine') {
    if (!this.audioContext || !this.gainNode) {
      this.initAudioContext();
    }
    
    const oscillator = this.audioContext!.createOscillator();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, this.audioContext!.currentTime);
    
    // Create a separate gain node for this tone
    const toneGain = this.audioContext!.createGain();
    toneGain.connect(this.gainNode!);
    
    // Smooth envelope
    toneGain.gain.setValueAtTime(0, this.audioContext!.currentTime);
    toneGain.gain.linearRampToValueAtTime(1, this.audioContext!.currentTime + 0.01);
    toneGain.gain.linearRampToValueAtTime(0, this.audioContext!.currentTime + duration);
    
    oscillator.connect(toneGain);
    oscillator.start();
    oscillator.stop(this.audioContext!.currentTime + duration);
  }

  async playWakeWord() {
    // Cheerful ascending arpeggio
    await this.playTone(440, 0.15); // A4
    await this.playTone(554.37, 0.15); // C#5
    await this.playTone(659.25, 0.15); // E5
  }

  async playSuccess() {
    // Happy major chord
    await this.playTone(523.25, 0.2); // C5
    await this.playTone(659.25, 0.3); // E5
    await this.playTone(783.99, 0.4); // G5
  }

  async playError() {
    // Descending minor second
    await this.playTone(440, 0.2); // A4
    await this.playTone(415.30, 0.4); // Ab4
  }

  async playListeningStart() {
    // Single gentle tone
    await this.playTone(440, 0.15, 'sine');
  }

  async playListeningStop() {
    // Lower gentle tone
    await this.playTone(350, 0.15, 'sine');
  }
}

export const soundEffects = SoundEffects.getInstance();
