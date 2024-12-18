import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mic, MicOff } from "lucide-react";
import { voiceRecognition } from "@/lib/voice";
import { processVoiceCommand } from "@/lib/openai";
import { voiceSynthesis } from "@/lib/voice-synthesis";
import { soundEffects } from "@/lib/sound-effects";
import { VoiceAnimation } from "./VoiceAnimation";
import fuzzysort from 'fuzzysort';
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

  // Constants for fuzzy matching
  const FUZZY_THRESHOLD = -2000;
  const BRAND_KEYWORDS = ['bud', 'coors', 'miller', 'michelob', 'dos', 'corona'];

  // Enhanced normalization with brand name preservation
  const normalizeText = (text: string) => {
    let normalized = text.toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
    
    // Preserve brand names
    BRAND_KEYWORDS.forEach(brand => {
      const regex = new RegExp(`\\b${brand}\\b`, 'gi');
      normalized = normalized.replace(regex, brand);
    });
    
    return normalized;
  };

  // Find best matching drink using multiple strategies
  const findBestMatch = (targetName: string, menuItems: Drink[]): Drink | null => {
    const normalizedTarget = normalizeText(targetName);
    
    // Strategy 1: Direct match (case-insensitive)
    const directMatch = menuItems.find(d => 
      normalizeText(d.name) === normalizedTarget ||
      normalizeText(d.name).replace('light', 'lite') === normalizedTarget.replace('light', 'lite')
    );
    if (directMatch) return directMatch;
    
    // Strategy 2: Fuzzy matching with prepared targets
    const fuzzyResults = fuzzysort.go(normalizedTarget, menuItems.map(item => ({
      ...item,
      searchStr: normalizeText(item.name)
    })), {
      keys: ['searchStr'],
      threshold: FUZZY_THRESHOLD,
      allowTypo: true
    });
    
    if (fuzzyResults.length > 0 && fuzzyResults[0].obj) {
      return fuzzyResults[0].obj as Drink;
    }
    
    // Strategy 3: Brand-focused matching
    const targetWords = normalizedTarget.split(' ');
    const brandWord = targetWords.find(word => BRAND_KEYWORDS.includes(word));
    
    if (brandWord) {
      const brandMatches = menuItems.filter(d => 
        normalizeText(d.name).includes(brandWord)
      );
      
      if (brandMatches.length === 1) return brandMatches[0];
      
      // If multiple matches, try to narrow down by light/lite
      const isLight = targetWords.some(w => ['light', 'lite'].includes(w));
      if (isLight) {
        const lightMatch = brandMatches.find(d => 
          ['light', 'lite'].some(l => 
            normalizeText(d.name).includes(l)
          )
        );
        if (lightMatch) return lightMatch;
      }
    }
    
    return null;
  };

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
        try {
          if (finalResponse?.trim()) {
            console.log('Attempting to speak:', finalResponse);
            await voiceSynthesis.speak(finalResponse, "alloy");
          }
        } catch (synthError) {
          console.error('Voice synthesis error:', synthError);
          setStatus('Voice response failed. ' + finalResponse);
        }
      }
    } catch (error) {
      console.error('Response handling error:', error);
      setStatus(response);
    }
  };

  useEffect(() => {
    setIsSupported(voiceRecognition.isSupported());

    const setupVoiceRecognition = () => {
      voiceRecognition.on<void>('wakeWord', async () => {
        await soundEffects.playWakeWord();
        setStatus("Listening for order...");
      });

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

        clearTimeout(processingTimeout);
        
        const now = Date.now();
        const commandHash = `${text}-${Math.floor(now / 2000)}`;
        
        if (commandHash === lastProcessedCommand || isProcessingCommand) {
          console.log('Skipping duplicate command or processing in progress');
          return;
        }

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

      voiceRecognition.on<VoiceError>('error', async (error) => {
        if (!error) {
          console.error('Received undefined error');
          await handleResponse('An unknown error occurred', 'processing');
          return;
        }
        console.error('Voice recognition error:', error);
        await handleResponse(error.message, error.type);
        
        if (error.type === 'network') {
          setIsListening(false);
        } else {
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
            const drink = findBestMatch(item.name, drinks);

            if (drink) {
              onAddToCart(drink, item.quantity);
              successfulItems.push(`${item.quantity} ${drink.name}`);
            } else {
              failedItems.push(item.name);
            }
          }

          // Only send one response based on the overall result
          if (successfulItems.length > 0 && failedItems.length === 0) {
            await soundEffects.playSuccess();
            await handleResponse(intent.conversational_response);
          } else if (successfulItems.length > 0 && failedItems.length > 0) {
            await soundEffects.playSuccess();
            const successMsg = `Added ${successfulItems.join(' and ')}`;
            const failMsg = `but couldn't find ${failedItems.join(', ')}`;
            await handleResponse(`${successMsg}, ${failMsg}`);
          } else {
            await soundEffects.playError();
            await handleResponse(`Sorry, I couldn't find ${failedItems.join(', ')} in our menu.`);
          }
          break;
        }

        case "incomplete_order": {
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