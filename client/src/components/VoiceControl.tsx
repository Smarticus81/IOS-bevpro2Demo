import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  const [isSupported, setIsSupported] = useState(true);

  useEffect(() => {
    setIsSupported(voiceRecognition.isSupported());

    const setupVoiceRecognition = () => {
      voiceRecognition.on('wakeWord', () => {
        setStatus("Listening for order...");
      });

      voiceRecognition.on('speech', (text: string) => {
        console.log('Processing speech:', text);
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

      voiceRecognition.on('error', (errorMessage: string) => {
        console.error('Voice recognition error:', errorMessage);
        setStatus(`Error: ${errorMessage}`);
        setIsListening(false);
        
        // Reset status after error message
        setTimeout(() => {
          setStatus("");
        }, 3000);
      });
    };

    setupVoiceRecognition();

    return () => {
      voiceRecognition.stop();
    };
  }, [drinks]);

  const processOrder = async (text: string) => {
    try {
      const intent = await processVoiceCommand(text);
      
      if (intent.type === "order") {
        let orderSuccess = false;
        
        for (const item of intent.items) {
          const drink = drinks.find(d => 
            d.name.toLowerCase().includes(item.name.toLowerCase()) || 
            item.name.toLowerCase().includes(d.name.toLowerCase())
          );

          if (drink) {
            onAddToCart(drink, item.quantity);
            orderSuccess = true;
          }
        }

        setStatus(orderSuccess ? intent.conversational_response : "Sorry, I couldn't find that drink");
      } else if (intent.type === "query") {
        let response = intent.conversational_response;
        
        if (intent.category) {
          const categoryDrinks = drinks.filter(d => 
            d.category.toLowerCase() === intent.category?.toLowerCase()
          );
          if (categoryDrinks.length > 0) {
            const drinkNames = categoryDrinks.map(d => d.name).join(', ');
            response += ` We have: ${drinkNames}`;
          }
        }
        
        setStatus(response);
      }
    } catch (error) {
      console.error("Error processing voice command:", error);
      setStatus("Sorry, I didn't catch that. Could you please repeat?");
    }

    setTimeout(() => {
      setStatus("Waiting for 'hey bar'...");
    }, 5000);
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
