import { motion } from "framer-motion";
import { Mic, MicOff, Power } from "lucide-react";
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
import type { DrinkItem } from "@/types/speech";
import { useCart } from "@/contexts/CartContext";
import { logger } from "@/lib/logger";
import { voiceRecognition } from "@/lib/voice";

export function VoiceControlButton() {
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const { cart, addToCart, removeItem, placeOrder, isProcessing } = useCart();
  const [mode, setMode] = useState<'wake_word' | 'command' | 'shutdown'>('wake_word');

  // Fetch drinks data with optimized caching
  const { data: drinks = [] } = useQuery<DrinkItem[]>({
    queryKey: ["/api/drinks"],
    retry: 1,
    staleTime: 30000,
  });

  // Initialize voice commands with proper cart state
  const { isListening, startListening, stopListening, isSupported } =
    useVoiceCommands({
      drinks,
      cart,
      onAddToCart: addToCart,
      onRemoveItem: removeItem,
      onPlaceOrder: placeOrder,
      isProcessing,
    });

  // Start listening for wake word on mount
  useEffect(() => {
    if (isSupported) {
      startListening();

      // Listen for mode changes
      const handleModeChange = (data: { mode: string, isActive: boolean }) => {
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
        toast({
          title: "Voice Control",
          description: "System shutting down",
          duration: 3000,
        });
      };

      voiceRecognition.on('modeChange', handleModeChange);
      voiceRecognition.on('shutdown', handleShutdown);

      return () => {
        voiceRecognition.off('modeChange', handleModeChange);
        voiceRecognition.off('shutdown', handleShutdown);
      };
    }
  }, [isSupported, startListening, toast]);

  // Handle manual shutdown
  const handleShutdown = async () => {
    try {
      if (!isSupported) {
        setShowDialog(true);
        return;
      }

      await stopListening();
      setMode('shutdown');
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
    switch (mode) {
      case 'command':
        return "bg-red-500 hover:bg-red-600 animate-pulse";
      case 'wake_word':
        return "bg-gradient-to-b from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600";
      case 'shutdown':
        return "bg-gray-400 hover:bg-gray-500";
      default:
        return "bg-gradient-to-b from-zinc-800 to-black hover:from-zinc-700 hover:to-black";
    }
  };

  const getButtonIcon = () => {
    switch (mode) {
      case 'command':
        return <Mic className="h-6 w-6" />;
      case 'wake_word':
        return <Mic className="h-6 w-6 opacity-70" />;
      case 'shutdown':
        return <Power className="h-6 w-6" />;
      default:
        return <MicOff className="h-6 w-6" />;
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
          onClick={handleShutdown}
          size="lg"
          className={`rounded-full p-6 shadow-lg transition-all duration-300
            ${getButtonStyle()}
            ${isProcessing ? "opacity-50 cursor-not-allowed" : ""}`}
          disabled={!isSupported || isProcessing}
          aria-label={mode === 'command' ? "Listening for commands" : "Listening for wake word"}
        >
          {getButtonIcon()}
        </Button>
      </motion.div>

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