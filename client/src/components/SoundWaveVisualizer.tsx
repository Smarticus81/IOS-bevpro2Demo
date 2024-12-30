import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

interface Props {
  isListening: boolean;
  mode: 'wake_word' | 'command' | 'shutdown';
}

const NUM_BARS = 32;
const MIN_BAR_HEIGHT = 2;
const MAX_BAR_HEIGHT = 50;

export function SoundWaveVisualizer({ isListening, mode }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>();
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!isListening) {
      if (audioContextRef.current?.state === 'running') {
        audioContextRef.current.suspend();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    const initializeAudio = async () => {
      try {
        // Create audio context if it doesn't exist
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContext();
        } else if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
        }

        // Get microphone stream
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const source = audioContextRef.current.createMediaStreamSource(stream);
        
        // Create analyser node
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;
        analyserRef.current.smoothingTimeConstant = 0.7;
        
        // Connect audio nodes
        source.connect(analyserRef.current);
        
        // Start visualization
        animate();
      } catch (error) {
        console.error('Error initializing audio:', error);
      }
    };

    const animate = () => {
      if (!canvasRef.current || !analyserRef.current) return;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Get frequency data
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw visualization
      const barWidth = canvas.width / NUM_BARS;
      const barGap = 2;
      
      for (let i = 0; i < NUM_BARS; i++) {
        // Get average of frequency range for this bar
        const startFreq = Math.floor(i * dataArray.length / NUM_BARS);
        const endFreq = Math.floor((i + 1) * dataArray.length / NUM_BARS);
        let sum = 0;
        for (let j = startFreq; j < endFreq; j++) {
          sum += dataArray[j];
        }
        const average = sum / (endFreq - startFreq);
        
        // Calculate bar height
        const barHeight = (average / 255) * (MAX_BAR_HEIGHT - MIN_BAR_HEIGHT) + MIN_BAR_HEIGHT;
        
        // Draw bar
        const hue = mode === 'command' ? 0 : 120; // Red for command mode, green for wake word
        ctx.fillStyle = `hsla(${hue}, 80%, 60%, 0.8)`;
        ctx.fillRect(
          i * (barWidth + barGap),
          (canvas.height - barHeight) / 2,
          barWidth - barGap,
          barHeight
        );
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    initializeAudio();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isListening, mode]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: isListening ? 1 : 0, scale: isListening ? 1 : 0.9 }}
      transition={{ duration: 0.2 }}
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
    >
      <canvas
        ref={canvasRef}
        width={200}
        height={100}
        className="rounded-lg bg-black/10"
      />
    </motion.div>
  );
}
