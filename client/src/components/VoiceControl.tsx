import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mic, MicOff } from "lucide-react";
import { voiceRecognition } from "@/lib/voice";
import { processVoiceCommand } from "@/lib/openai";
import { voiceSynthesis } from "@/lib/voice-synthesis";
import { soundEffects } from "@/lib/sound-effects";
import { VoiceAnimation } from "./VoiceAnimation";
import type { Drink } from "@db/schema";
import type { ErrorType, VoiceError } from "@/types/speech";

interface VoiceControlProps {
  drinks: Drink[];
  onAddToCart: (drink: Drink, quantity: number) => void;
}

export function VoiceControl({ drinks, onAddToCart }: VoiceControlProps) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
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
      
      // Clear any pending voice synthesis before starting new response
      voiceSynthesis.clearQueue();
      setStatus(finalResponse);
      
      if (!errorType || errorType !== 'synthesis') {
        try {
          await voiceSynthesis.speak(finalResponse, "alloy");
        } catch (synthError) {
          console.error('Voice synthesis error:', synthError);
          // Don't throw, just log the error and continue with visual feedback
        }
      }
    } catch (error) {
      console.error('Response handling error:', error);
      setStatus(response); // Fallback to visual feedback
    }
  };

  useEffect(() => {
    setIsSupported(voiceRecognition.isSupported());

    const setupVoiceRecognition = () => {
      voiceRecognition.on<void>('wakeWord', async () => {
        await soundEffects.playWakeWord();
        setStatus("Listening for order...");
      });

      // Command deduplication and debouncing
      let processingTimeout: NodeJS.Timeout;
      let lastProcessedCommand = '';
      let lastProcessedTime = 0;
      let isProcessingCommand = false;

      voiceRecognition.on<string>('speech', async (text) => {
        if (!text) {
          console.error('Received empty speech text');
          await soundEffects.playError();
          setStatus("Sorry, I didn't hear anything");
          return;
        }

        // Clear any pending processing
        clearTimeout(processingTimeout);
        
        // Check for duplicate commands within a 2-second window
        const now = Date.now();
        const commandHash = `${text}-${Math.floor(now / 2000)}`;
        
        if (commandHash === lastProcessedCommand || isProcessingCommand) {
          console.log('Skipping duplicate command or processing in progress');
          return;
        }

        // Debounce the processing
        processingTimeout = setTimeout(async () => {
          if (isProcessingCommand) return;
          
          try {
            isProcessingCommand = true;
            lastProcessedCommand = commandHash;
            lastProcessedTime = now;
            
            console.log('Processing speech:', text);
            setIsProcessing(true);
            await soundEffects.playListeningStop();
            await processOrder(text);
          } finally {
            isProcessingCommand = false;
            setIsProcessing(false);
          }
        }, 300);
      });

      voiceRecognition.on<void>('start', async () => {
        await soundEffects.playListeningStart();
        setIsListening(true);
        setStatus("Waiting for 'hey bar'...");
      });

      voiceRecognition.on<void>('stop', async () => {
        await soundEffects.playListeningStop();
        setIsListening(false);
        setIsProcessing(false);
        setStatus("");
      });

      voiceRecognition.on<VoiceError>('error', (error) => {
        if (!error) {
          console.error('Received undefined error');
          handleResponse('An unknown error occurred', 'processing');
          return;
        }
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
    let processingSuccessful = false;
    try {
      console.log('Starting to process order:', text);
      
      const intent = await processVoiceCommand(text);
      if (!intent) {
        console.error('Received null intent from processVoiceCommand');
        throw new Error('Invalid response from voice command processing');
      }
      
      console.log('Processing intent:', JSON.stringify(intent, null, 2));

      switch (intent.type) {
        case "order": {
          const successfulItems: string[] = [];
          const failedItems: string[] = [];
          
          // Process all items first before any responses
          for (const item of intent.items) {
            const drink = drinks.find(d => 
              d.name.toLowerCase().includes(item.name.toLowerCase()) || 
              item.name.toLowerCase().includes(d.name.toLowerCase())
            );

            if (drink) {
              onAddToCart(drink, item.quantity);
              successfulItems.push(`${item.quantity} ${drink.name}`);
            } else {
              failedItems.push(item.name);
            }
          }

          // Only send one response based on the overall result
          if (successfulItems.length > 0 && failedItems.length === 0) {
            // All items succeeded
            await soundEffects.playSuccess();
            await handleResponse(intent.conversational_response);
          } else if (successfulItems.length > 0 && failedItems.length > 0) {
            // Partial success
            await soundEffects.playSuccess();
            const successMsg = `Added ${successfulItems.join(' and ')}`;
            const failMsg = `but couldn't find ${failedItems.join(', ')}`;
            await handleResponse(`${successMsg}, ${failMsg}`);
          } else {
            // All items failed
            await soundEffects.playError();
            await handleResponse(`Sorry, I couldn't find ${failedItems.join(', ')} in our menu.`);
          }
          break;
        }

        case "incomplete_order": {
          // Play a gentle sound for incomplete orders
          await soundEffects.playListeningStart();
          await handleResponse(intent.conversational_response);
          break;
        }
        
        case "query": {
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
          break;
        }

        case "greeting": {
          await soundEffects.playListeningStart();
          await handleResponse(intent.conversational_response);
          break;
        }

        default: {
          console.log('Unknown intent type:', intent);
          await soundEffects.playError();
          await handleResponse("I didn't understand that request. Could you please try again?");
        }
      }
    } catch (error) {
      console.error("Error processing voice command:", error);
      await soundEffects.playError();
      await handleResponse("Sorry, I had trouble processing that request. Could you please repeat?");
    }

    // Reset status after a delay
    setTimeout(() => {
      if (isListening) {
        setStatus("Waiting for 'hey bar'...");
      }
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
      <div className="flex items-center gap-4">
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
        
        <VoiceAnimation 
          isListening={isListening} 
          isProcessing={isProcessing} 
        />
        
        {status && (
          <Badge variant="secondary" className="h-9">
            {status}
          </Badge>
        )}
      </div>
    </div>
  );
}
