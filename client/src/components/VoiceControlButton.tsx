import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useVoiceCommands } from "@/hooks/use-voice-commands";
import { useToast } from "@/hooks/use-toast";

export function VoiceControlButton() {
  const { isListening, startListening, stopListening, isSupported } = useVoiceCommands();
  const { toast } = useToast();

  const handleClick = async () => {
    try {
      console.log('Voice control button clicked:', { isSupported, isListening });
      
      if (!isSupported) {
        console.warn('Voice commands not supported in this browser');
        toast({
          title: "Not Supported",
          description: "Voice commands are not supported in this browser.",
          variant: "destructive",
        });
        return;
      }

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

  // Don't render if speech recognition is not supported
  if (!isSupported) {
    return null;
  }

  return (
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
          disabled={!isSupported}
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
