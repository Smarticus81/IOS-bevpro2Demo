import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mic, MicOff } from "lucide-react";
import { voiceRecognition } from "@/lib/voice";
import type { Drink } from "@db/schema";

interface VoiceControlProps {
  drinks: Drink[];
  onAddToCart: (drink: Drink, quantity: number) => void;
}

export function VoiceControl({ drinks, onAddToCart }: VoiceControlProps) {
  const [isListening, setIsListening] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [isSupported, setIsSupported] = useState(true);

  useEffect(() => {
    setIsSupported(voiceRecognition.isSupported());

    voiceRecognition.on('wakeWord', () => {
      setStatus("Listening for order...");
    });

    voiceRecognition.on('speech', (text: string) => {
      processOrder(text);
    });

    voiceRecognition.on('start', () => {
      setIsListening(true);
      setStatus("Waiting for 'hey bar'...");
    });

    voiceRecognition.on('stop', () => {
      setIsListening(false);
      setStatus("");
    });

    return () => {
      voiceRecognition.stop();
    };
  }, [drinks]);

  const processOrder = (text: string) => {
    // Simple order processing logic
    // Look for patterns like "two beers" or "one moscow mule"
    const words = text.toLowerCase().split(' ');
    const quantities: { [key: string]: number } = {
      'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
      '1': 1, '2': 2, '3': 3, '4': 4, '5': 5
    };

    let quantity = 1;
    let drinkName = '';

    for (let i = 0; i < words.length; i++) {
      if (quantities[words[i]]) {
        quantity = quantities[words[i]];
        drinkName = words.slice(i + 1).join(' ');
        break;
      }
    }

    if (!drinkName) {
      drinkName = words.join(' ');
    }

    const drink = drinks.find(d => 
      d.name.toLowerCase().includes(drinkName) || 
      drinkName.includes(d.name.toLowerCase())
    );

    if (drink) {
      onAddToCart(drink, quantity);
      setStatus(`Added ${quantity} ${drink.name} to order`);
    } else {
      setStatus("Sorry, I didn't understand that order");
    }

    setTimeout(() => {
      setStatus("Waiting for 'hey bar'...");
    }, 3000);
  };

  const toggleListening = () => {
    if (!isSupported) {
      setStatus("Voice recognition not supported in this browser");
      return;
    }

    if (isListening) {
      voiceRecognition.stop();
    } else {
      voiceRecognition.start();
    }
  };

  return (
    <div className="flex items-center gap-4 mb-6">
      <Button
        onClick={toggleListening}
        variant={isListening ? "destructive" : "default"}
        className="w-40"
        disabled={!isSupported}
      >
        {isListening ? (
          <>
            <MicOff className="mr-2 h-4 w-4" />
            Stop Listening
          </>
        ) : (
          <>
            <Mic className="mr-2 h-4 w-4" />
            Start Listening
          </>
        )}
      </Button>
      
      {status && (
        <Badge variant="secondary" className="h-9">
          {status}
        </Badge>
      )}
    </div>
  );
}
