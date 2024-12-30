
import { motion } from "framer-motion";
import { Mic, MicOff, HelpCircle } from "lucide-react";
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
import type { DrinkItem } from "@/types/speech";
import { useCart } from "@/contexts/CartContext";
import { logger } from "@/lib/logger";
import { VoiceTutorial } from "./VoiceTutorial";

export function VoiceControlButton() {
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const { cart, addToCart, removeItem, placeOrder, isProcessing } = useCart();

  const { data: drinks = [] } = useQuery<DrinkItem[]>({
    queryKey: ["/api/drinks"],
    retry: 1,
    staleTime: 30000,
  });

  const { isListening, startListening, stopListening, isSupported } =
    useVoiceCommands({
      drinks,
      cart,
      onAddToCart: addToCart,
      onRemoveItem: removeItem,
      onPlaceOrder: placeOrder,
      isProcessing,
    });

  const handleClick = async () => {
    try {
      if (!isSupported) {
        setShowDialog(true);
        return;
      }

      if (isListening) {
        logger.info('Stopping voice recognition');
        await stopListening();
        toast({
          title: "Voice Control",
          description: "Voice commands stopped",
          duration: 2000,
        });
      } else {
        logger.info('Starting voice recognition');
        await startListening();
        toast({
          title: "Voice Control",
          description: "Say 'help' to learn available commands",
          duration: 2000,
        });
      }
    } catch (error) {
      logger.error("Voice control error:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process voice command",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex justify-end"
        >
          <Button
            onClick={() => setShowTutorial(true)}
            size="lg"
            variant="outline"
            className="rounded-full shadow-lg"
            aria-label="Show voice command tutorial"
          >
            <HelpCircle className="h-5 w-5" />
          </Button>
        </motion.div>

        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex justify-end"
        >
          <Button
            onClick={handleClick}
            size="lg"
            className={`rounded-full p-6 shadow-lg transition-all duration-300
              ${
                isListening
                  ? "bg-red-500 hover:bg-red-600 animate-pulse"
                  : "bg-gradient-to-b from-zinc-800 to-black hover:from-zinc-700 hover:to-black"
              }
              ${isProcessing ? "opacity-50 cursor-not-allowed" : ""}`}
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

      {showTutorial && <VoiceTutorial onClose={() => setShowTutorial(false)} />}
    </>
  );
}
