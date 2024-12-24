import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useVoiceCommands } from "@/hooks/use-voice-commands";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

interface VoiceControlButtonProps {
  onAddToCart: (action: { type: 'ADD_ITEM'; drink: any; quantity: number }) => void;
  onRemoveItem: (drinkId: number) => void;
  onPlaceOrder: () => Promise<void>;
  cart?: Array<{ drink: any; quantity: number }>;
}

export function VoiceControlButton({ 
  onAddToCart,
  onRemoveItem,
  onPlaceOrder,
  cart = []
}: VoiceControlButtonProps) {
  const { toast } = useToast();

  // Fetch drinks data
  const { data: drinks = [], isLoading: isDrinksLoading } = useQuery<any[]>({
    queryKey: ["/api/drinks"],
  });

  // Validate required props and data
  const hasRequiredProps = onAddToCart && onRemoveItem && onPlaceOrder;
  const isReady = !isDrinksLoading && Array.isArray(drinks) && drinks.length > 0;

  // Initialize voice commands with validated dependencies
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
    onPlaceOrder
  });

  const handleClick = async () => {
    try {
      if (!hasRequiredProps) {
        toast({
          title: "Not Ready",
          description: "Required functions are not available.",
          variant: "destructive",
        });
        return;
      }

      if (!isSupported) {
        toast({
          title: "Not Supported",
          description: "Voice commands are not supported in this browser.",
          variant: "destructive",
        });
        return;
      }

      if (!isReady) {
        toast({
          title: "Loading",
          description: "Please wait while we load the menu data.",
        });
        return;
      }

      if (isListening) {
        await stopListening();
      } else {
        await startListening();
      }
    } catch (error) {
      console.error('Voice control error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "An error occurred with voice control",
        variant: "destructive",
      });
    }
  };

  // Don't render if dependencies aren't ready
  if (!hasRequiredProps || !isReady) {
    return null;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="fixed bottom-6 right-6 z-50 flex gap-2"
      >
        <Button
          onClick={handleClick}
          size="lg"
          className={`rounded-full p-6 shadow-lg transition-all duration-300
            ${isListening 
              ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
              : 'bg-gradient-to-b from-zinc-800 to-black hover:from-zinc-700 hover:to-black'
            }`}
          disabled={!isSupported || !isReady}
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
  );
}