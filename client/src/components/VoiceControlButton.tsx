import { motion } from "framer-motion";
import { Mic, MicOff } from "lucide-react";
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
import { useState } from "react";
import type { DrinkItem, CartItem, AddToCartAction } from "@/types/speech";

interface VoiceControlButtonProps {
  onAddToCart?: (action: AddToCartAction) => void;
  onRemoveItem?: (drinkId: number) => void;
  onPlaceOrder?: () => Promise<void>;
  cart?: CartItem[];
}

export function VoiceControlButton({ 
  onAddToCart,
  onRemoveItem,
  onPlaceOrder,
  cart = []
}: VoiceControlButtonProps) {
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);

  // Fetch drinks data with optimized caching
  const { data: drinks = [] } = useQuery<DrinkItem[]>({
    queryKey: ["/api/drinks"],
    retry: 1,
    staleTime: 30000, // Cache for 30 seconds
  });

  // Initialize voice commands with proper dependency checks
  const { 
    isListening, 
    isProcessing,
    startListening, 
    stopListening, 
    isSupported 
  } = useVoiceCommands({
    drinks,
    cart,
    onAddToCart,
    onRemoveItem,
    onPlaceOrder
  });

  // Handle button click with proper error handling
  const handleClick = () => {
    try {
      if (!isSupported) {
        setShowDialog(true);
        return;
      }

      if (isListening) {
        stopListening();
        toast({
          title: "Voice Control",
          description: "Voice commands stopped",
          duration: 2000,
        });
      } else {
        startListening();
        toast({
          title: "Voice Control",
          description: "Say 'help' to learn available commands",
          duration: 2000,
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
          className={`rounded-full p-6 shadow-lg transition-all duration-300
            ${isListening 
              ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
              : 'bg-gradient-to-b from-zinc-800 to-black hover:from-zinc-700 hover:to-black'
            }
            ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
          disabled={!isSupported || isProcessing}
          aria-label={isListening ? "Stop voice commands" : "Start voice commands"}
        >
          {isListening ? (
            <MicOff className="h-6 w-6" />
          ) : (
            <Mic className="h-6 w-6" />
          )}
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