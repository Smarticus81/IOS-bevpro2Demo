import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mic, MicOff } from "lucide-react";
import { voiceRecognition } from "@/lib/voice";
import { processVoiceCommand } from "@/lib/openai";
import { voiceSynthesis } from "@/lib/voice-synthesis";
import type { Drink } from "@db/schema";

interface VoiceControlProps {
  drinks: Drink[];
  onAddToCart: (drink: Drink, quantity: number) => void;
}

export function VoiceControl({ drinks, onAddToCart }: VoiceControlProps) {
  const [isListening, setIsListening] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [isSupported, setIsSupported] = useState(true);

  // Error types for better error handling
  type ErrorType = 'recognition' | 'synthesis' | 'network' | 'processing';
  
  const handleResponse = async (response: string, errorType?: ErrorType) => {
    try {
      let finalResponse = response;
      
      if (errorType) {
        const errorMessages = {
          recognition: "I'm having trouble understanding you. Could you speak more clearly?",
          synthesis: "I understood you, but I'm having trouble responding. I'll display my response instead.",
          network: "I'm having connection issues. Please check your internet connection.",
          processing: "I'm having trouble processing your request. Could you try again?"
        };
        
        finalResponse = errorMessages[errorType];
        console.warn(`${errorType} error occurred:`, response);
      }
      
      setStatus(finalResponse);
      
      if (!errorType || errorType !== 'synthesis') {
        await voiceSynthesis.speak(finalResponse, "alloy");
      }
    } catch (error) {
      console.error('Voice synthesis error:', error);
      setStatus(response); // Fallback to visual feedback
    }
  };

  useEffect(() => {
    setIsSupported(voiceRecognition.isSupported());

    const setupVoiceRecognition = () => {
      voiceRecognition.on<void>('wakeWord', () => {
        setStatus("Listening for order...");
      });

      voiceRecognition.on<string>('speech', (text) => {
        if (text) {
          console.log('Processing speech:', text);
          processOrder(text);
        } else {
          console.error('Received empty speech text');
          setStatus("Sorry, I didn't hear anything");
        }
      });

      voiceRecognition.on<void>('start', () => {
        setIsListening(true);
        setStatus("Waiting for 'hey bar'...");
      });

      voiceRecognition.on<void>('stop', () => {
        setIsListening(false);
        setStatus("");
      });

      voiceRecognition.on<{ type: ErrorType; message: string }>('error', (error) => {
        console.error('Voice recognition error:', error);
        handleResponse(error.message, error.type);
        
        if (error.type === 'network') {
          setIsListening(false);
        } else {
          // For other errors, keep listening but show the error temporarily
          setTimeout(() => {
            setStatus("Waiting for 'hey bar'...");
          }, 3000);
        }
      });
    };

    setupVoiceRecognition();

    return () => {
      voiceRecognition.stop();
    };
  }, [drinks]);

  const processOrder = async (text: string) => {
    try {
      console.log('Starting to process order:', text);
      
      const intent = await processVoiceCommand(text).catch(error => {
        console.error('Voice command processing failed:', error);
        throw error;
      });
      
      if (intent.type === "order") {
        let orderSuccess = false;
        console.log('Processing order intent:', intent);
        
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

        const response = orderSuccess ? intent.conversational_response : "Sorry, I couldn't find that drink";
        await handleResponse(response);
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
        
        await handleResponse(response);
      }
    } catch (error) {
      console.error("Error processing voice command:", error);
      await handleResponse("Sorry, I didn't catch that. Could you please repeat?");
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
