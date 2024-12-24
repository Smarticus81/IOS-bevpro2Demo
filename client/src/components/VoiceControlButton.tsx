import { motion, AnimatePresence } from "framer-motion";
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
} from "@/components/ui/dialog";
import { useState } from "react";

interface VoiceControlButtonProps {
  onAddToCart?: (action: { type: 'ADD_ITEM'; drink: any; quantity: number }) => void;
  onRemoveItem?: (drinkId: number) => void;
  onPlaceOrder?: () => Promise<void>;
  cart?: Array<{ drink: any; quantity: number }>;
}

export function VoiceControlButton({ 
  onAddToCart,
  onRemoveItem,
  onPlaceOrder,
  cart = []
}: VoiceControlButtonProps) {
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);

  // Fetch drinks data
  const { data: drinks = [], isLoading: isDrinksLoading } = useQuery<any[]>({
    queryKey: ["/api/drinks"],
    retry: 1,
    staleTime: 30000, // Cache drinks data for 30 seconds
  });

  // Initialize voice commands with proper dependency checks
  const { 
    isListening, 
    startListening, 
    stopListening, 
    isSupported 
  } = useVoiceCommands({
    drinks: isDrinksLoading ? [] : drinks,
    cart,
    onAddToCart,
    onRemoveItem,
    onPlaceOrder
  });

  const handleClick = async () => {
    try {
      console.log('Voice button clicked:', {
        isSupported,
        isDrinksLoading,
        isListening,
        hasHandlers: {
          addToCart: !!onAddToCart,
          removeItem: !!onRemoveItem,
          placeOrder: !!onPlaceOrder
        }
      });

      if (!isSupported) {
        setShowDialog(true);
        return;
      }

      // Stop if already listening
      if (isListening) {
        await stopListening();
        toast({
          title: "Voice Control",
          description: "Voice commands stopped",
        });
        return;
      }

      // Start listening if all requirements are met
      if (drinks.length > 0 && onAddToCart && onRemoveItem && onPlaceOrder) {
        await startListening();
        toast({
          title: "Voice Control",
          description: "Listening for commands... Try saying 'help' to learn what I can do",
        });
      } else {
        toast({
          title: "Setup Error",
          description: "Voice control requires cart management functions to be configured.",
          variant: "destructive",
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

  // Determine if button should be disabled
  const isButtonDisabled = !drinks.length || !onAddToCart || !onRemoveItem || !onPlaceOrder;

  return (
    <>
      <AnimatePresence mode="wait">
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
              }`}
            disabled={isButtonDisabled}
            aria-label={isListening ? "Stop voice commands" : "Start voice commands"}
            title={isListening ? "Stop voice commands" : "Start voice commands"}
          >
            <AnimatePresence mode="wait">
              {isListening ? (
                <motion.div
                  key="mic-off"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <MicOff className="h-6 w-6" />
                </motion.div>
              ) : (
                <motion.div
                  key="mic-on"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Mic className="h-6 w-6" />
                </motion.div>
              )}
            </AnimatePresence>
          </Button>
        </motion.div>
      </AnimatePresence>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Voice Commands Not Supported</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Voice commands are not supported in your browser. Please try using a modern browser like Chrome, Edge, or Safari.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}