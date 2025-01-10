import { motion } from "framer-motion";
import { Mic, MicOff, Power } from "lucide-react";
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
import { useState } from "react";
import type { DrinkItem } from "@/types/speech";
import { useCart } from "@/contexts/CartContext";
import { logger } from "@/lib/logger";
import { voiceRecognition } from "@/lib/voice";
import { SoundWaveVisualizer } from "./SoundWaveVisualizer";

interface DrinksResponse {
  drinks: DrinkItem[];
  pagination: {
    currentPage: number;
    limit: number;
    totalPages: number;
    totalItems: number;
  };
}

export function VoiceControlButton() {
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const { cart, addToCart, removeItem, placeOrder, isProcessing } = useCart();
  const [mode, setMode] = useState<'wake_word' | 'command' | 'shutdown'>('wake_word');
  const [isInitialized, setIsInitialized] = useState(false);

  const { data: drinksResponse } = useQuery<DrinksResponse>({
    queryKey: ["/api/drinks"],
    retry: 1,
    staleTime: 30000,
  });

  const drinks = drinksResponse?.drinks || [];

  const { isListening, startListening, stopListening, isSupported, metrics } =
    useVoiceCommands({
      drinks,
      cart,
      onAddToCart: async (action) => {
        await addToCart(action);
      },
      onRemoveItem: removeItem,
      onPlaceOrder: placeOrder,
      isProcessing,
    });

  const initializeVoiceControl = async () => {
    if (!isSupported) {
      setShowDialog(true);
      return;
    }

    if (!drinks.length) {
      toast({
        title: "Error",
        description: "Cannot initialize voice control: No drinks data available",
        variant: "destructive",
      });
      return;
    }

    try {
      if (!isInitialized) {
        const handleModeChange = (data: { mode: string; isActive: boolean }) => {
          setMode(data.mode as 'wake_word' | 'command' | 'shutdown');
          toast({
            title: "Voice Control",
            description: data.mode === 'wake_word'
              ? "Listening for wake word (Hey Bar/Hey Bev)"
              : "Command mode active. Say 'stop listening' to exit",
            duration: 3000,
          });
        };

        const handleShutdown = () => {
          setMode('shutdown');
          setIsInitialized(false);
          toast({
            title: "Voice Control",
            description: "System shutting down",
            duration: 3000,
          });
        };

        voiceRecognition.on('modeChange', handleModeChange);
        voiceRecognition.on('shutdown', handleShutdown);

        if (drinks.length > 0) {
          await startListening();
          setIsInitialized(true);

          toast({
            title: "Voice Control",
            description: "System ready. Say 'Hey Bar' or 'Hey Bev' to start",
            duration: 3000,
          });
        }
      }
    } catch (error) {
      logger.error('Failed to initialize voice control:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to initialize voice control",
        variant: "destructive",
      });
    }
  };

  const handleShutdown = async () => {
    try {
      if (!isSupported) {
        setShowDialog(true);
        return;
      }

      await stopListening();
      setMode('shutdown');
      setIsInitialized(false);
      toast({
        title: "Voice Control",
        description: "System shutdown",
        duration: 2000,
      });
    } catch (error) {
      logger.error("Voice control error:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to shutdown",
        variant: "destructive",
      });
    }
  };

  const getButtonStyle = () => {
    if (!isInitialized) {
      return "bg-gray-900 text-white";
    }

    switch (mode) {
      case 'command':
        return "bg-blue-500 text-white";
      case 'wake_word':
        return "bg-gray-900 text-white";
      case 'shutdown':
        return "bg-gray-400 text-white";
      default:
        return "bg-gray-900 text-white";
    }
  };

  const getButtonIcon = () => {
    if (!isInitialized) {
      return <Mic className="h-5 w-5" />;
    }

    switch (mode) {
      case 'command':
        return <Mic className="h-5 w-5" />;
      case 'wake_word':
        return <Mic className="h-5 w-5 opacity-70" />;
      case 'shutdown':
        return <Power className="h-5 w-5" />;
      default:
        return <MicOff className="h-5 w-5" />;
    }
  };

  return (
    <>
      <div className="fixed left-6 bottom-6 z-50 flex items-center gap-3">
        <motion.button
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={isInitialized ? handleShutdown : initializeVoiceControl}
          className={`
            h-12 px-6 rounded-lg flex items-center gap-2
            transition-colors duration-200
            ${getButtonStyle()}
            ${isProcessing ? "opacity-50 cursor-not-allowed" : ""}
          `}
          disabled={!isSupported || isProcessing}
          aria-label={!isInitialized ? "Initialize voice control" : mode === 'command' ? "Listening for commands" : "Listening for wake word"}
        >
          {getButtonIcon()}
          <span className="font-medium">
            {!isInitialized ? "Voice Control" : mode === 'command' ? "Listening" : "Ready"}
          </span>
        </motion.button>

        <SoundWaveVisualizer
          isListening={isListening && isInitialized}
          mode={mode}
        />
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Voice Commands Not Supported</DialogTitle>
            <DialogDescription>
              Voice commands are not supported in your browser. Please try using
              a modern browser like Chrome, Edge, or Safari.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  );
}