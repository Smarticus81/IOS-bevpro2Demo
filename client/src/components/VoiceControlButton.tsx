import { motion } from "framer-motion";
import { Mic, MicOff, Power, Settings } from "lucide-react";
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
import { SoundWaveVisualizer } from "./SoundWaveVisualizer";
import { VoiceTutorial } from "./VoiceTutorial";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { VoiceCustomization } from './VoiceCustomization';
import type { VoiceSettings } from '@/types/voice';


const TUTORIAL_SHOWN_KEY = 'voice_tutorial_completed';

export function VoiceControlButton() {
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const { cart, addToCart, removeItem, placeOrder, isProcessing } = useCart();
  const [mode, setMode] = useState<'wake_word' | 'command' | 'shutdown'>('wake_word');
  const [isInitialized, setIsInitialized] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({
    wakeWord: 'Hey Bar',
    volume: 50,
    commandPreferences: [
      {
        command: 'Complete Order',
        action: 'system',
        aliases: ['process order', 'finish order', 'checkout'],
        enabled: true
      },
      {
        command: 'Cancel Order',
        action: 'system',
        aliases: ['clear cart', 'start over'],
        enabled: true
      },
      {
        command: 'Help',
        action: 'system',
        aliases: ['what can I say', 'show commands'],
        enabled: true
      }
    ]
  });

  const handleSaveSettings = (newSettings: VoiceSettings) => {
    setVoiceSettings(newSettings);
    // Update voice recognition with new settings
    // This will be implemented in the next step
    toast({
      title: 'Settings Saved',
      description: 'Voice command preferences have been updated.',
      duration: 3000,
    });
  };


  // Fetch drinks data with optimized caching
  const { data: drinks = [] } = useQuery<DrinkItem[]>({
    queryKey: ["/api/drinks"],
    retry: 1,
    staleTime: 30000,
  });

  // Check if tutorial has been shown before
  useEffect(() => {
    const tutorialShown = localStorage.getItem(TUTORIAL_SHOWN_KEY);
    if (!tutorialShown) {
      setShowTutorial(true);
    }
  }, []);

  // Initialize voice commands with proper cart state
  const { isListening, startListening, stopListening, isSupported, metrics } =
    useVoiceCommands({
      drinks,
      cart,
      onAddToCart: addToCart,
      onRemoveItem: removeItem,
      onPlaceOrder: placeOrder,
      isProcessing,
    });

  // Handle tutorial completion
  const handleTutorialComplete = () => {
    localStorage.setItem(TUTORIAL_SHOWN_KEY, 'true');
    setShowTutorial(false);
    toast({
      title: "Tutorial Complete",
      description: "You can now use voice commands! Click the microphone button to start.",
      duration: 5000,
    });
  };

  // Initialize voice control
  const initializeVoiceControl = async () => {
    if (!isSupported) {
      setShowDialog(true);
      return;
    }

    try {
      if (!isInitialized) {
        // Set up event listeners
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

        // Start listening
        await startListening();
        setIsInitialized(true);

        toast({
          title: "Voice Control",
          description: "System ready. Say 'Hey Bar' or 'Hey Bev' to start",
          duration: 3000,
        });
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

  // Handle shutdown
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
      return "bg-gradient-to-b from-zinc-800 to-black hover:from-zinc-700 hover:to-black";
    }

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
    if (!isInitialized) {
      return <Mic className="h-6 w-6" />;
    }

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

  // Format success rate for display
  const formatSuccessRate = (rate: number) => {
    return `${Math.round(rate)}%`;
  };

  return (
    <>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="fixed bottom-6 right-6 z-50"
      >
        <div className="relative flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowSettings(true)}
            className="rounded-full shadow-lg"
            disabled={!isSupported}
          >
            <Settings className="h-4 w-4" />
          </Button>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={isInitialized ? handleShutdown : initializeVoiceControl}
                  size="lg"
                  className={`rounded-full p-6 shadow-lg transition-all duration-300
                    ${getButtonStyle()}
                    ${isProcessing ? "opacity-50 cursor-not-allowed" : ""}`}
                  disabled={!isSupported || isProcessing}
                  aria-label={!isInitialized ? "Initialize voice control" : mode === 'command' ? "Listening for commands" : "Listening for wake word"}
                >
                  {getButtonIcon()}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left" align="center">
                <div className="text-sm">
                  <p className="font-semibold mb-1">Voice Command Success Rate</p>
                  <p>Overall: {formatSuccessRate(metrics.overall)}</p>
                  <div className="mt-1 space-y-0.5">
                    <p>Orders: {formatSuccessRate(metrics.categories.drink_order.successRate)}</p>
                    <p>System: {formatSuccessRate(metrics.categories.system_command.successRate)}</p>
                    <p>Completion: {formatSuccessRate(metrics.categories.order_completion.successRate)}</p>
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <SoundWaveVisualizer
            isListening={isListening && isInitialized}
            mode={mode}
          />
        </div>
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

      <VoiceTutorial
        isOpen={showTutorial}
        onComplete={handleTutorialComplete}
      />

      <VoiceCustomization
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        settings={voiceSettings}
        onSave={handleSaveSettings}
      />
    </>
  );
}