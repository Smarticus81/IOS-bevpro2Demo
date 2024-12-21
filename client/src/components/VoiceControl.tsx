import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mic, MicOff, Minimize2, Maximize2 } from "lucide-react";
import { motion } from "framer-motion";
import { voiceRecognition } from "@/lib/voice";
import { processVoiceCommand } from "@/lib/openai";
import { voiceSynthesis } from "@/lib/voice-synthesis";
import { soundEffects } from "@/lib/sound-effects";
import { orderProcessingDebouncer } from "@/lib/debounce";
import { VoiceAnimation } from "./VoiceAnimation";
import { EmojiReaction, type SentimentType } from "./EmojiReaction";
import fuzzysort from 'fuzzysort';
import type { Drink } from "@db/schema";
import type { ErrorType, VoiceError, WakeWordEvent } from "@/types/speech";

export interface AddItemParams {
  type: 'ADD_ITEM';
  drink: Drink & { price: number };
  quantity: number;
}

export interface CompleteTransactionParams {
  type: 'COMPLETE_TRANSACTION';
}

export type CartAction = AddItemParams | CompleteTransactionParams;

export interface VoiceControlProps {
  drinks: Drink[];
  onAddToCart: (params: CartAction) => void;
  onVoiceCommand?: (text: string) => Promise<void>;
  variant?: 'default' | 'compact';
}

export function VoiceControl({ drinks, onAddToCart, onVoiceCommand, variant = 'default' }: VoiceControlProps) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isProcessingCommand, setIsProcessingCommand] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [isSupported, setIsSupported] = useState(true);
  const [mode, setMode] = useState<'order' | 'inquiry'>('order');
  const [isWakeWordOnly, setIsWakeWordOnly] = useState(true);
  const [sentiment, setSentiment] = useState<SentimentType>(null); // Only listen for wake words initially

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
    const fuzzyResults = fuzzysort.go(normalizedTarget, menuItems.map(item => 
      normalizeText(item.name)
    ), {
      threshold: FUZZY_THRESHOLD,
      all: true
    });

    if (fuzzyResults.length > 0 && fuzzyResults[0]) {
      const matchIndex = fuzzyResults[0].target;
      return menuItems.find(item => normalizeText(item.name) === matchIndex) || null;
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
      console.log('Current mode:', mode, 'Attempting response:', finalResponse);

      console.log('HandleResponse - Current mode:', mode, 'Response:', finalResponse);
      
      if (mode === 'inquiry') { // Only speak in inquiry mode
        try {
          if (finalResponse?.trim()) {
            console.log('Attempting voice synthesis:', {
              mode,
              response: finalResponse,
              timestamp: new Date().toISOString()
            });
            
            await voiceSynthesis.speak(finalResponse, "alloy");
            console.log('Voice synthesis completed successfully');
          } else {
            console.log('Empty response, skipping voice synthesis');
          }
        } catch (error) {
          console.error('Voice synthesis error:', {
            error,
            mode,
            response: finalResponse,
            timestamp: new Date().toISOString()
          });
          setStatus('Voice response failed. ' + finalResponse);
        }
      } else {
        console.log('Skipping voice response - currently in order mode');
      }
    } catch (error) {
      console.error('Response handling error:', error);
      setStatus(response);
    }
  };

  useEffect(() => {
    setIsSupported(voiceRecognition.isSupported());

    const setupVoiceRecognition = () => {
      voiceRecognition.on<WakeWordEvent>('wakeWord', async (event) => {
        if (!event) {
          console.error('Received invalid wake word event');
          return;
        }
        
        console.log('Wake word event received:', event);
        await soundEffects.playWakeWord();
        
        // Use a callback to ensure state updates are atomic
        setIsWakeWordOnly(false);
        setMode(event.mode);
        
        console.log('State transition:', {
          newMode: event.mode,
          wakeWordOnly: false,
          timestamp: new Date().toISOString()
        });
        
        setStatus(event.mode === 'order' ? "Listening for order..." : "How can I help you?");
      });

      let processingTimeout: NodeJS.Timeout;
      let lastProcessedCommand = '';
      let lastProcessedTime = 0;

      voiceRecognition.on<string>('speech', async (text) => {
        if (!text) {
          console.error('Received empty speech text');
          await soundEffects.playError();
          setStatus("Sorry, I didn't hear anything");
          return;
        }

        console.log('Received voice input:', {
          text,
          mode,
          isWakeWordOnly,
          isProcessingCommand,
          timestamp: new Date().toISOString()
        });

        clearTimeout(processingTimeout);

        const now = Date.now();
        const commandHash = `${text}-${Math.floor(now / 1000)}`; // Increase debounce window to 1 second

        if (isProcessingCommand) {
          console.log('Skipping command - processing in progress:', {
            text,
            commandHash,
            timestamp: new Date().toISOString()
          });
          return;
        }

        if (commandHash === lastProcessedCommand && (now - lastProcessedTime) < 1000) {
          console.log('Skipping duplicate command:', {
            text,
            commandHash,
            timeSinceLastCommand: now - lastProcessedTime,
            timestamp: new Date().toISOString()
          });
          return;
        }

        processingTimeout = setTimeout(async () => {
          try {
            setIsProcessingCommand(true);
            lastProcessedCommand = commandHash;
            lastProcessedTime = now;

            console.log('Starting command processing:', {
              text,
              commandHash,
              timestamp: new Date().toISOString()
            });
            
            setIsProcessing(true);
            await soundEffects.playListeningStop();
            await processVoiceInput(text);
            
            console.log('Completed command processing:', {
              text,
              commandHash,
              timestamp: new Date().toISOString()
            });
          } finally {
            setIsProcessingCommand(false);
            setIsProcessing(false);
          }
        }, 500); // Increase debounce delay
      });

      voiceRecognition.on<void>('start', async () => {
        await soundEffects.playListeningStart();
        setIsListening(true);
        setStatus("Say 'hey bar' to order drinks or 'hey bev' to ask questions.");
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
            setStatus("Say 'hey bar' to order drinks or 'hey bev' to ask questions.");
          }, 3000);
        }
      });
    };

    setupVoiceRecognition();

    return () => {
      voiceRecognition.stop();
    };
  }, [drinks]);

  const processVoiceInput = async (text: string) => {
    try {
      console.log('Processing voice input:', text);

      // If onVoiceCommand is provided, use it instead of default processing
      if (onVoiceCommand) {
        await onVoiceCommand(text);
        return;
      }

      const intent = await processVoiceCommand(text);
      setSentiment(intent.sentiment as SentimentType);
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
              // Validate and transform the drink data
              const drinkPrice = typeof drink.price === 'string' ? parseFloat(drink.price) : drink.price;
              
              if (isNaN(drinkPrice)) {
                console.error('Invalid price for drink:', {
                  drink,
                  originalPrice: drink.price,
                  parsedPrice: drinkPrice
                });
                failedItems.push(item.name);
                continue;
              }

              console.log('Adding drink to cart:', {
                name: drink.name,
                quantity: item.quantity,
                price: drinkPrice,
                total: drinkPrice * item.quantity
              });
              
              onAddToCart({ 
                type: 'ADD_ITEM', 
                drink: {
                  ...drink,
                  price: drinkPrice
                }, 
                quantity: item.quantity 
              });
              successfulItems.push(`${item.quantity} ${drink.name}`);
            } else {
              failedItems.push(item.name);
            }
          }

          // Handle response based on mode
          if (successfulItems.length > 0 && failedItems.length === 0) {
            await soundEffects.playSuccess();
            if (mode === 'inquiry') {
              await handleResponse(intent.conversational_response);
            }
          } else if (successfulItems.length > 0 && failedItems.length > 0) {
            await soundEffects.playSuccess();
            if (mode === 'inquiry') {
              const successMsg = `Added ${successfulItems.join(' and ')}`;
              const failMsg = `but couldn't find ${failedItems.join(', ')}`;
              await handleResponse(`${successMsg}, ${failMsg}`);
            }
          } else {
            await soundEffects.playError();
            if (mode === 'inquiry') {
              await handleResponse(`Sorry, I couldn't find ${failedItems.join(', ')} in our menu.`);
            }
          }
          break;
        }

        case "incomplete_order": {
          await soundEffects.playListeningStart();
          if (mode === 'inquiry') {
            await handleResponse(intent.conversational_response);
          }
          break;
        }

        case "query": {
          // Always respond to queries in inquiry mode
          if (mode === 'inquiry') {
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
          break;
        }

        case "greeting": {
          await soundEffects.playListeningStart();
          if (mode === 'inquiry') {
            await handleResponse(intent.conversational_response);
          }
          break;
        }

        case "order_complete": {
          try {
            await orderProcessingDebouncer('complete-order', async () => {
              console.log('Starting order completion:', {
                mode,
                intent,
                timestamp: new Date().toISOString()
              });

              setIsProcessingCommand(true);
              
              try {
                // Process the transaction
                onAddToCart({ 
                  type: 'COMPLETE_TRANSACTION'
                });
                
                // Wait briefly to allow the UI to update
                await new Promise(resolve => setTimeout(resolve, 500));
                
                await soundEffects.playSuccess();
                setMode('order'); // Reset to order mode
                setIsWakeWordOnly(true); // Enter wake word only mode
                
                const completionMessage = "Order complete. Say 'hey bar' to start a new order or 'hey bev' for questions.";
                setStatus(completionMessage);
                
                if (mode === 'inquiry') {
                  await handleResponse(intent.conversational_response || completionMessage);
                }

                console.log('Order completed successfully', {
                  timestamp: new Date().toISOString()
                });

                return { success: true };
              } catch (error) {
                console.error('Error during order completion:', error);
                throw error;
              }
            });
          } catch (error) {
            if (error.message === 'Command in cooldown period') {
              console.log('Order completion in cooldown period, ignoring request');
              return;
            }
            
            console.error('Failed to complete order:', error);
            await soundEffects.playError();
            const errorMessage = "Sorry, there was an issue completing your order. Please try again.";
            setStatus(errorMessage);
            if (mode === 'inquiry') {
              await handleResponse(errorMessage);
            }
          } finally {
            setIsProcessingCommand(false);
          }
          break;
        }

        case "shutdown": {
          await soundEffects.playSuccess();
          await handleResponse(intent.conversational_response);
          // Temporarily pause voice recognition instead of complete shutdown
          voiceRecognition.stop();
          setIsListening(false);
          setMode('order');
          setIsWakeWordOnly(true); // Reset to wake word only mode
          setStatus("Voice system paused. Click 'Start Listening' to resume.");
          break;
        }

        case "cancel": {
          await soundEffects.playError();
          setMode('order'); // Reset to order mode
          if (mode === 'inquiry') {
            await handleResponse(intent.conversational_response);
          }
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
        if (isWakeWordOnly) {
          setStatus("Say 'hey bar' to start a new order or 'hey bev' to ask questions.");
        } else {
          setStatus(`In ${mode} mode. What would you like?`);
        }
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
      setStatus("");
    } else {
      // Reset state when starting
      setMode('order');
      setIsWakeWordOnly(true);
      setIsProcessing(false);
      setIsProcessingCommand(false);
      setSentiment(null);
      setStatus("Say 'hey bar' to order drinks or 'hey bev' to ask questions.");
      voiceRecognition.start();
    }
  };

  const [isMinimized, setIsMinimized] = useState(false);

  return variant === 'compact' ? (
    <Button
      onClick={toggleListening}
      variant={isListening ? "destructive" : "outline"}
      className={`
        relative px-4 h-9
        bg-gradient-to-r from-primary/90 to-primary/70
        hover:from-primary hover:to-primary/80
        text-white font-medium shadow-md
        transition-all duration-300
        ${isListening ? 'ring-2 ring-primary animate-pulse-soft' : 'ring-1 ring-primary/20'}
      `}
      disabled={!isSupported}
    >
      <span className="relative z-10">Bev</span>
      {(isListening || isProcessing) && (
        <span className="absolute inset-0 rounded bg-primary/20 animate-pulse" />
      )}
    </Button>
  ) : (
    <div className="flex items-center gap-4">
      <Button
        onClick={toggleListening}
        variant={isListening ? "destructive" : "default"}
        className={`
          w-12 h-12 rounded-full p-0 relative
          bg-white/90 hover:bg-white/95
          shadow-lg hover:shadow-xl
          transition-all duration-300
          border border-primary/10
          ${isListening ? 'ring-2 ring-destructive' : 'ring-1 ring-primary/20'}
        `}
        disabled={!isSupported}
      >
        <span className="font-semibold text-sm text-primary/80">Bev</span>
        <div className={`
          absolute inset-0 rounded-full
          ${isListening ? 'animate-pulse-ring bg-destructive/5' : 'bg-primary/5'}
        `} />
      </Button>

      <VoiceAnimation
        isListening={isListening}
        isProcessing={isProcessing}
        amplitude={isListening ? 1.5 : 1}
        sentiment={sentiment === 'positive' ? 'positive' : sentiment === 'negative' ? 'negative' : 'neutral'}
      />

      {status && (
        <div className="flex items-center gap-4">
          <Badge variant="secondary" className="h-9">
            {status}
          </Badge>
          <EmojiReaction sentiment={sentiment} />
        </div>
      )}
    </div>
  );
}