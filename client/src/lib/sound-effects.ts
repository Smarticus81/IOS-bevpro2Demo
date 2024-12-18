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
    // Playful ascending major triad with gentle fade
    await this.playTone(523.25, 0.12, 'sine'); // C5
    await this.playTone(659.25, 0.12, 'sine'); // E5
    await this.playTone(783.99, 0.15, 'sine'); // G5
  }

  async playSuccess() {
    // Cheerful major seventh chord with gentle attack
    await this.playTone(523.25, 0.15, 'sine'); // C5
    await this.playTone(659.25, 0.15, 'sine'); // E5
    await this.playTone(783.99, 0.15, 'sine'); // G5
    await this.playTone(987.77, 0.3, 'sine');  // B5
  }

  async playError() {
    // Gentle descending perfect fifth with soft fade
    await this.playTone(523.25, 0.15, 'sine'); // C5
    await this.playTone(392.00, 0.25, 'sine'); // G4
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
