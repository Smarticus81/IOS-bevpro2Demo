import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useVoiceCommands } from "@/hooks/use-voice-commands";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useState, useEffect } from "react";
import { VoiceFeedback } from "./VoiceFeedback";
import type { DrinkItem, CartItem, AddToCartAction } from "@/types/speech";

interface VoiceControlButtonProps {
  onAddToCart?: (action: AddToCartAction) => void;
  onRemoveItem?: (drinkId: number) => void;
  onPlaceOrder?: () => Promise<void>;
  cart?: CartItem[];
  setIsProcessingVoice?: (isProcessing: boolean) => void;
}

export function VoiceControlButton({ 
  onAddToCart,
  onRemoveItem,
  onPlaceOrder,
  cart = [],
  setIsProcessingVoice
}: VoiceControlButtonProps) {
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [volume, setVolume] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch drinks data
  const { data: drinks = [] } = useQuery<DrinkItem[]>({
    queryKey: ["/api/drinks"],
    retry: 1,
    staleTime: 30000,
  });

  // Initialize voice commands with proper dependency checks
  const { 
    isListening, 
    startListening, 
    stopListening, 
    isSupported 
  } = useVoiceCommands({
    drinks,
    cart,
    onAddToCart,
    onRemoveItem,
    onPlaceOrder,
    onProcessingStateChange: setIsProcessing
  });

  // Update processing state in parent component
  useEffect(() => {
    if (setIsProcessingVoice) {
      setIsProcessingVoice(isProcessing);
    }
  }, [isProcessing, setIsProcessingVoice]);

  // Handle audio volume detection
  useEffect(() => {
    let audioContext: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let dataArray: Uint8Array | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let animationFrame: number | null = null;

    const initAudioAnalysis = async () => {
      try {
        if (!isListening) return;

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioContext = new AudioContext();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 32;
        source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        dataArray = new Uint8Array(analyser.frequencyBinCount);

        const updateVolume = () => {
          if (!analyser || !dataArray) return;
          analyser.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setVolume(average / 128); // Normalize to 0-1
          animationFrame = requestAnimationFrame(updateVolume);
        };

        updateVolume();
      } catch (error) {
        console.error('Error initializing audio analysis:', error);
      }
    };

    if (isListening) {
      initAudioAnalysis();
    }

    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
      if (source) source.disconnect();
      if (audioContext) audioContext.close();
    };
  }, [isListening]);

  // Handle button click with proper error handling
  const handleClick = async () => {
    try {
      if (!isSupported) {
        setShowDialog(true);
        return;
      }

      if (isListening) {
        await stopListening();
        toast({
          title: "Voice Control",
          description: "Voice commands stopped",
        });
      } else {
        await startListening();
        toast({
          title: "Voice Control",
          description: "Listening for commands... Try saying 'help' to learn what I can do",
        });
      }
    } catch (error) {
      console.error('Voice control error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process voice command",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="fixed bottom-6 right-6 z-50"
      >
        <Button
          onClick={handleClick}
          size="lg"
          className="rounded-full p-6 shadow-lg transition-all duration-300 bg-transparent hover:bg-transparent disabled:opacity-50"
          disabled={!isSupported}
          aria-label={isListening ? "Stop voice commands" : "Start voice commands"}
        >
          <VoiceFeedback 
            isListening={isListening}
            isProcessing={isProcessing}
            volume={volume}
          />
        </Button>
      </motion.div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Voice Commands Not Supported</DialogTitle>
            <DialogDescription>
              Voice commands are not supported in your browser. Please try using a modern browser like Chrome, Edge, or Safari.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  );
}