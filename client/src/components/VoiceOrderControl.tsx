import { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { processVoiceOrder, synthesizeOrderConfirmation, type VoiceOrderResult } from "@/lib/voice-order-service";

interface VoiceOrderControlProps {
  onOrderProcessed: (order: VoiceOrderResult['order']) => void;
  disabled?: boolean;
}

export function VoiceOrderControl({ onOrderProcessed, disabled }: VoiceOrderControlProps) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    return () => {
      if (mediaRecorder.current && mediaRecorder.current.state === 'recording') {
        mediaRecorder.current.stop();
      }
    };
  }, []);

  const startListening = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Your browser does not support voice recording');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
          channelCount: 1 // Mono audio for better compatibility
        } 
      });
      
      // Check for WebM support
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      
      mediaRecorder.current = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128000 // 128kbps for good quality
      });
      
      audioChunks.current = [];

      mediaRecorder.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.current.push(event.data);
        }
      };

      mediaRecorder.current.onstop = async () => {
        try {
          if (audioChunks.current.length === 0) {
            throw new Error('No audio recorded');
          }

          const audioBlob = new Blob(audioChunks.current, { type: mimeType });
          await processOrder(audioBlob);
          
        } catch (error) {
          console.error('Error processing audio:', error);
          toast({
            title: "Recording Error",
            description: error instanceof Error ? error.message : "Failed to process audio",
            variant: "destructive"
          });
        } finally {
          // Clean up the media stream
          stream.getTracks().forEach(track => track.stop());
        }
      };

      mediaRecorder.current.start();
      setIsListening(true);

      toast({
        title: "Listening",
        description: "Speak your order clearly...",
      });
    } catch (error) {
      console.error('Error accessing microphone:', error);
      toast({
        title: "Error",
        description: "Could not access microphone. Please check your permissions.",
        variant: "destructive",
      });
    }
  };

  const stopListening = () => {
    if (mediaRecorder.current && mediaRecorder.current.state === 'recording') {
      mediaRecorder.current.stop();
      setIsListening(false);
    }
  };

  const processOrder = async (audioBlob: Blob) => {
    if (isProcessing) {
      console.log('Skipping order processing - already processing');
      return;
    }

    setIsProcessing(true);
    try {
      const result = await processVoiceOrder(audioBlob);
      
      if (result.success && result.order) {
        // Handle shutdown command
        if (result.isShutdown || result.order.specialInstructions === 'shutdown_requested') {
          setIsListening(false);
          toast({
            title: "Voice Control Stopped",
            description: "Voice ordering has been disabled",
            variant: "default",
          });
          return;
        }

        // Handle empty orders
        if (result.order.items.length === 0) {
          toast({
            title: "No Order Detected",
            description: "Please try speaking your order again",
            variant: "default",
          });
          return;
        }

        try {
          // Generate and play confirmation audio
          const confirmationAudioUrl = await synthesizeOrderConfirmation(result.order);
          const audio = new Audio(confirmationAudioUrl);
          await audio.play();

          // Process the order
          onOrderProcessed(result.order);
          
          // Show success notification
          toast({
            title: "Order Received",
            description: `Added ${result.order.items.map(item => 
              `${item.quantity} ${item.name}`).join(', ')}`,
          });
        } catch (error) {
          console.error('Error processing successful order:', error);
          // Continue with order processing even if audio feedback fails
          onOrderProcessed(result.order);
        }
      } else if (result.error?.toLowerCase().includes('cooldown')) {
        // Handle debounce rejection gracefully
        console.log('Order processing debounced');
      } else {
        // Handle other errors
        toast({
          title: "Error",
          description: result.error || "Could not process your order. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error processing order:', error);
      toast({
        title: "Error",
        description: "Failed to process your order. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        className="relative"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
      >
        <Button
          onClick={isListening ? stopListening : startListening}
          disabled={disabled || isProcessing}
          className={`relative w-14 h-14 rounded-full p-0 ${
            isListening 
              ? 'bg-red-500 hover:bg-red-600' 
              : 'bg-gradient-to-b from-zinc-800 to-black hover:from-zinc-700 hover:to-black'
          }`}
        >
          <AnimatePresence mode="wait">
            {isProcessing ? (
              <motion.div
                key="processing"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
              >
                <Loader2 className="h-6 w-6 animate-spin text-white" />
              </motion.div>
            ) : isListening ? (
              <motion.div
                key="listening"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
              >
                <MicOff className="h-6 w-6 text-white" />
              </motion.div>
            ) : (
              <motion.div
                key="ready"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
              >
                <Mic className="h-6 w-6 text-white" />
              </motion.div>
            )}
          </AnimatePresence>
        </Button>

        {isListening && (
          <motion.div
            className="absolute -inset-2 rounded-full"
            initial={{ opacity: 0, scale: 1.2 }}
            animate={{ 
              opacity: [0.2, 0.5, 0.2], 
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            <div className="w-full h-full rounded-full bg-red-500/20" />
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
