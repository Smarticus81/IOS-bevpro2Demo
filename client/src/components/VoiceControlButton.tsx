import { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff, Power } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useVoiceCommands } from '@/hooks/use-voice-commands';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import type { DrinkItem } from '@/types/speech';
import { SoundWaveVisualizer } from './SoundWaveVisualizer';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { logger } from '@/lib/logger';

interface DrinksResponse {
  drinks: DrinkItem[];
  pagination: {
    currentPage: number;
    limit: number;
    totalPages: number;
    totalItems: number;
  };
}

interface Props {
  onInventorySearch?: (searchTerm: string) => void;
  onCategoryFilter?: (category: string) => void;
  onLowStockFilter?: () => void;
}

export function VoiceControlButton({ onInventorySearch, onCategoryFilter, onLowStockFilter }: Props) {
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [mode, setMode] = useState<'wake_word' | 'command' | 'shutdown'>('wake_word');
  const [isInitialized, setIsInitialized] = useState(false);

  const { data: drinksResponse } = useQuery<DrinksResponse>({
    queryKey: ["/api/drinks"],
    retry: 1,
    staleTime: 30000,
  });

  const drinks = drinksResponse?.drinks || [];

  const { isListening, startListening, stopListening, isSupported } = useVoiceCommands({
    drinks,
    cart: [], // Empty cart for inventory mode
    onAddToCart: async () => {}, // No-op for inventory mode
    onRemoveItem: async () => {}, // No-op for inventory mode
    onPlaceOrder: async () => {}, // No-op for inventory mode
    isProcessing: false,
    onInventorySearch,
    onCategoryFilter,
    onLowStockFilter,
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
      await startListening();
      setIsInitialized(true);
      setMode('wake_word');

      toast({
        title: "Voice Control",
        description: "System ready. Try commands like 'check stock of [drink]' or 'show low stock items'",
        duration: 3000,
      });
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

  const getButtonStyle = useCallback(() => {
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
  }, [isInitialized, mode]);

  const getButtonIcon = useCallback(() => {
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
  }, [isInitialized, mode]);

  return (
    <>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="relative"
      >
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={isInitialized ? handleShutdown : initializeVoiceControl}
                size="icon"
                className={`rounded-full p-4 shadow-lg transition-all duration-300 ${getButtonStyle()}`}
                disabled={!isSupported}
                aria-label={isInitialized ? "Stop voice control" : "Start voice control"}
              >
                {getButtonIcon()}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              {isInitialized ? "Stop voice control" : "Start voice control"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <SoundWaveVisualizer
          isListening={isListening && isInitialized}
          mode={mode}
        />
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