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

        // Create analyser node with enhanced settings
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;
        analyserRef.current.smoothingTimeConstant = 0.7; // Smoother transitions

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

      // Clear canvas with a subtle gradient background
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, 'rgba(0, 0, 0, 0.05)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0.02)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

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

        // Calculate bar height with smooth animation
        const barHeight = (average / 255) * (MAX_BAR_HEIGHT - MIN_BAR_HEIGHT) + MIN_BAR_HEIGHT;

        // Draw bar with glossy effect
        const hue = mode === 'command' ? 0 : mode === 'wake_word' ? 120 : 240;
        const baseColor = `hsla(${hue}, 80%, 60%, 0.8)`;
        const highlightColor = `hsla(${hue}, 80%, 80%, 0.9)`;
        const shadowColor = `hsla(${hue}, 80%, 40%, 0.7)`;

        // Create gradient for glossy effect
        const barGradient = ctx.createLinearGradient(
          i * (barWidth + barGap),
          (canvas.height - barHeight) / 2,
          i * (barWidth + barGap),
          (canvas.height + barHeight) / 2
        );

        barGradient.addColorStop(0, highlightColor);
        barGradient.addColorStop(0.5, baseColor);
        barGradient.addColorStop(1, shadowColor);

        ctx.fillStyle = barGradient;

        // Draw rounded rectangle for each bar
        const x = i * (barWidth + barGap);
        const y = (canvas.height - barHeight) / 2;
        const width = barWidth - barGap;
        const radius = 2;

        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + barHeight - radius);
        ctx.quadraticCurveTo(x + width, y + barHeight, x + width - radius, y + barHeight);
        ctx.lineTo(x + radius, y + barHeight);
        ctx.quadraticCurveTo(x, y + barHeight, x, y + barHeight - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();

        ctx.fill();

        // Add reflection
        const reflection = ctx.createLinearGradient(0, y, 0, y + barHeight);
        reflection.addColorStop(0, `hsla(${hue}, 80%, 100%, 0.2)`);
        reflection.addColorStop(1, `hsla(${hue}, 80%, 100%, 0)`);
        ctx.fillStyle = reflection;
        ctx.fill();
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
      <motion.canvas
        ref={canvasRef}
        width={200}
        height={100}
        className="rounded-lg bg-black/10 backdrop-blur-lg 
                   border border-white/10 shadow-lg"
        animate={{
          boxShadow: isListening 
            ? [
                "0 0 0 0 rgba(255,255,255,0)",
                "0 0 20px 10px rgba(255,255,255,0.1)",
                "0 0 0 0 rgba(255,255,255,0)"
              ]
            : "none"
        }}
        transition={{
          boxShadow: {
            repeat: Infinity,
            duration: 2,
          }
        }}
      />
    </motion.div>
  );
}