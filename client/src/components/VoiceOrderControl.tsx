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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      audioChunks.current = [];

      mediaRecorder.current.ondataavailable = (event) => {
        audioChunks.current.push(event.data);
      };

      mediaRecorder.current.onstop = async () => {
        const audioBlob = new Blob(audioChunks.current, { type: 'audio/wav' });
        await processOrder(audioBlob);
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
    setIsProcessing(true);
    try {
      const result = await processVoiceOrder(audioBlob);
      
      if (result.success && result.order) {
        // Generate and play confirmation audio
        const confirmationAudioUrl = await synthesizeOrderConfirmation(result.order);
        const audio = new Audio(confirmationAudioUrl);
        await audio.play();

        onOrderProcessed(result.order);
      } else {
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
