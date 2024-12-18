import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff } from "lucide-react";
import { voiceRecognition } from "@/lib/voice";
import { processVoiceCommand } from "@/lib/openai";
import type { Drink } from "@db/schema";

interface VoiceControlProps {
  drinks: Drink[];
  onAddToCart: (drink: Drink, quantity: number) => void;
}

export function VoiceControl({ drinks, onAddToCart }: VoiceControlProps) {
  const [isListening, setIsListening] = useState(false);
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    voiceRecognition.onWakeWord(() => {
      setStatus("Listening for order...");
    });

    voiceRecognition.onSpeech(async (text) => {
      try {
        const intent = await processVoiceCommand(text);
        
        if (intent.type === "order") {
          for (const item of intent.items) {
            const drink = drinks.find(d => 
              d.name.toLowerCase() === item.name.toLowerCase()
            );
            
            if (drink) {
              onAddToCart(drink, item.quantity);
            }
          }
          setStatus("Order added to cart");
        }
      } catch (error) {
        setStatus("Sorry, I didn't understand that");
      }

      setTimeout(() => setStatus(""), 3000);
    });

    return () => {
      voiceRecognition.stop();
    };
  }, [drinks, onAddToCart]);

  const toggleListening = () => {
    if (isListening) {
      voiceRecognition.stop();
      setStatus("");
    } else {
      voiceRecognition.start();
      setStatus("Waiting for 'hey bar'...");
    }
    setIsListening(!isListening);
  };

  return (
    <div className="flex items-center gap-4 mb-6">
      <Button
        onClick={toggleListening}
        variant={isListening ? "destructive" : "default"}
        className="w-40"
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
        <span className="text-sm text-muted-foreground">
          {status}
        </span>
      )}
    </div>
  );
}
