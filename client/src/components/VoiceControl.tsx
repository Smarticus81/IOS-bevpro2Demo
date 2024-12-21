import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mic } from "lucide-react";
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

  const toggleListening = () => {
    // Voice control implementation will go here
    setIsListening(!isListening);
    setStatus(isListening ? "" : "Voice control coming soon...");
  };

  return variant === 'compact' ? (
    <Button
      onClick={toggleListening}
      variant={isListening ? "destructive" : "outline"}
      className="relative px-4 h-9 bg-white/90 hover:bg-white/95"
    >
      <Mic className="h-4 w-4 mr-2" />
      <span>Voice</span>
    </Button>
  ) : (
    <div className="flex items-center gap-4">
      <Button
        onClick={toggleListening}
        variant={isListening ? "destructive" : "default"}
        className="relative"
      >
        <Mic className="h-4 w-4 mr-2" />
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