import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mic } from "lucide-react";
import { voiceService } from "@/lib/voice-realtime";
import { useToast } from "@/hooks/use-toast";
import type { Drink } from "@db/schema";

export interface CartAction {
  type: 'ADD_ITEM';
  drink: Drink;
  quantity: number;
}

export interface VoiceControlProps {
  drinks: Drink[];
  onAddToCart: (params: CartAction) => void;
  variant?: 'default' | 'compact';
}

export function VoiceControl({ drinks, onAddToCart, variant = 'default' }: VoiceControlProps) {
  const [isListening, setIsListening] = useState(false);
  const [status, setStatus] = useState<string>("");
  const { toast } = useToast();

  useEffect(() => {
    const handleMessage = (event: any) => {
      if (event.type === 'transcript' && event.text) {
        // Process voice command using the transcript
        processVoiceCommand(event.text);
      }
    };

    const handleError = (error: string) => {
      toast({
        title: "Voice Control Error",
        description: error,
        variant: "destructive",
      });
      setIsListening(false);
      setStatus("");
    };

    voiceService.on('message', handleMessage);
    voiceService.on('error', handleError);
    voiceService.on('connected', () => setStatus("Connected"));
    voiceService.on('disconnected', () => setStatus(""));

    return () => {
      voiceService.removeListener('message', handleMessage);
      voiceService.removeListener('error', handleError);
    };
  }, [toast, drinks, onAddToCart]);

  const processVoiceCommand = (text: string) => {
    // Simple command processing - can be enhanced later
    const lowerText = text.toLowerCase();
    
    // Find mentioned drink
    const mentionedDrink = drinks.find(drink => 
      lowerText.includes(drink.name.toLowerCase())
    );

    if (mentionedDrink) {
      // Default to quantity 1 if not specified
      const quantity = 1;
      onAddToCart({
        type: 'ADD_ITEM',
        drink: mentionedDrink,
        quantity
      });
      
      // Send confirmation message back through voice service
      voiceService.sendMessage({
        type: "response.create",
        response: {
          modalities: ["text"],
          instructions: `Added ${quantity} ${mentionedDrink.name} to your order`
        }
      });
    }
  };

  const toggleListening = async () => {
    try {
      if (isListening) {
        await voiceService.stopListening();
        setIsListening(false);
        setStatus("");
      } else {
        await voiceService.startListening();
        setIsListening(true);
        setStatus("Listening...");
      }
    } catch (error) {
      toast({
        title: "Voice Control Error",
        description: error instanceof Error ? error.message : "Failed to toggle voice control",
        variant: "destructive",
      });
    }
  };

  return variant === 'compact' ? (
    <Button
      onClick={toggleListening}
      variant={isListening ? "destructive" : "outline"}
      className="relative px-4 h-9 bg-white/90 hover:bg-white/95"
    >
      <Mic className={`h-4 w-4 mr-2 ${isListening ? 'text-red-500' : ''}`} />
      <span>Voice</span>
    </Button>
  ) : (
    <div className="flex items-center gap-4">
      <Button
        onClick={toggleListening}
        variant={isListening ? "destructive" : "default"}
        className="relative"
      >
        <Mic className={`h-4 w-4 mr-2 ${isListening ? 'text-red-500' : ''}`} />
        <span>Voice Control</span>
      </Button>

      {status && (
        <Badge variant="secondary" className="h-9">
          {status}
        </Badge>
      )}
    </div>
  );
}