import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useVoiceCommands } from "@/hooks/use-voice-commands";
import { useToast } from "@/hooks/use-toast";
import { voiceSynthesis } from "@/lib/voice-synthesis";
import { useQuery } from "@tanstack/react-query";

interface VoiceControlButtonProps {
  onAddToCart: (action: { type: 'ADD_ITEM'; drink: any; quantity: number }) => void;
  onRemoveItem: (drinkId: number) => void;
  onPlaceOrder: () => void;
  cart?: Array<{ drink: any; quantity: number }>;
}

// Default no-op functions for required props
const defaultProps = {
  onAddToCart: () => {
    console.warn('onAddToCart handler not provided');
  },
  onRemoveItem: () => {
    console.warn('onRemoveItem handler not provided');
  },
  onPlaceOrder: () => {
    console.warn('onPlaceOrder handler not provided');
  },
  cart: []
};

export function VoiceControlButton({
  onAddToCart = defaultProps.onAddToCart,
  onRemoveItem = defaultProps.onRemoveItem,
  onPlaceOrder = defaultProps.onPlaceOrder,
  cart = defaultProps.cart
}: VoiceControlButtonProps) {
  const { data: drinks = [], isLoading: isDrinksLoading } = useQuery<any[]>({
    queryKey: ["/api/drinks"],
  });

  // Enhanced logging for component state and debug info
  console.log('VoiceControlButton state:', {
    isDrinksLoading,
    drinksCount: drinks.length,
    hasAddToCart: typeof onAddToCart === 'function',
    hasRemoveItem: typeof onRemoveItem === 'function',
    hasPlaceOrder: typeof onPlaceOrder === 'function',
    cartItems: cart.length,
    timestamp: new Date().toISOString()
  });

  const { toast } = useToast();

  // Ensure we have the drinks data before enabling voice commands
  const isReady = !isDrinksLoading && drinks.length > 0;

  const { isListening, startListening, stopListening, isSupported } = useVoiceCommands({
    drinks,
    cart,
    onAddToCart,
    onRemoveItem,
    onPlaceOrder
  });

  const handleClick = async () => {
    try {
      console.log('Voice control button clicked:', {
        isSupported,
        isListening,
        drinksLoaded: isReady,
        cartSize: cart.length,
        timestamp: new Date().toISOString()
      });

      if (!isSupported) {
        console.warn('Voice commands not supported in this browser');
        toast({
          title: "Not Supported",
          description: "Voice commands are not supported in this browser.",
          variant: "destructive",
        });
        return;
      }

      // Ensure voice synthesis is stopped before toggling listening state
      await voiceSynthesis.stop();

      if (isListening) {
        console.log('Stopping voice recognition...');
        await stopListening();
      } else {
        console.log('Starting voice recognition...');
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

  // Don't render if speech recognition is not supported or drinks aren't loaded
  if (!isSupported || !isReady) {
    return null;
  }

  // Enhanced voice synthesis test with better error handling
  const handleTestVoice = async () => {
    try {
      // Ensure any ongoing synthesis is stopped
      await voiceSynthesis.stop();

      console.log('Testing voice synthesis...');
      await voiceSynthesis.speak("Hello! Voice synthesis is working correctly.", "professional");

      toast({
        title: "Voice Test",
        description: "Testing voice synthesis...",
      });
    } catch (error) {
      console.error('Voice synthesis test error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to test voice synthesis",
        variant: "destructive",
      });
    }
  };

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

        <Button
          onClick={handleTestVoice}
          size="lg"
          className="rounded-full p-6 shadow-lg transition-all duration-300 bg-gradient-to-b from-indigo-500 to-indigo-700 hover:from-indigo-400 hover:to-indigo-600"
          title="Test voice synthesis"
        >
          <Volume2 className="h-6 w-6" />
        </Button>
      </motion.div>
    </AnimatePresence>
  );
}