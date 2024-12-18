import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mic, MicOff } from "lucide-react";
import { voiceRecognition } from "@/lib/voice";
import { voiceTraining } from "@/lib/voice-training";
// import { processVoiceCommand } from "@/lib/openai"; // Removed
import { realtimeVoiceSynthesis } from "@/lib/voice-realtime";
import { soundEffects } from "@/lib/sound-effects";
import { VoiceAnimation } from "./VoiceAnimation";
import fuzzysort from 'fuzzysort';
import type { Drink } from "@db/schema";
import type { ErrorType, VoiceError, WakeWordEvent, VoiceSettings } from "@/types/speech";

interface VoiceControlProps {
  drinks: Drink[];
  onAddToCart: (drink: Drink, quantity: number) => void;
}

export function VoiceControl({ drinks, onAddToCart }: VoiceControlProps) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [isSupported, setIsSupported] = useState(true);
  const [mode, setMode] = useState<'order' | 'inquiry' | 'training'>('order');
  const [showTraining, setShowTraining] = useState(false);
  const [provider, setProvider] = useState<'elevenlabs' | 'webspeech'>('elevenlabs');
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [pitch, setPitch] = useState<number[]>([1.0]);
  const [rate, setRate] = useState<number[]>([1.0]);
  const [volume, setVolume] = useState<number[]>([1.0]);

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
      threshold: FUZZY_THRESHOLD
    });

    if (fuzzyResults.length > 0) {
      const bestMatchIndex = menuItems.findIndex(
        item => normalizeText(item.name) === fuzzyResults[0].target
      );
      if (bestMatchIndex !== -1) {
        return menuItems[bestMatchIndex];
      }
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

      try {
        if (finalResponse?.trim()) {
          console.log('Attempting voice synthesis:', {
            mode,
            response: finalResponse,
            audioContext: !!window.AudioContext,
            webAudioEnabled: 'AudioContext' in window,
            timestamp: new Date().toISOString()
          });

          // Ensure audioContext is initialized by user interaction
          await soundEffects.playListeningStop();

          // Add a small delay to ensure audio context is ready
          await new Promise(resolve => setTimeout(resolve, 100));

          await realtimeVoiceSynthesis.speak(finalResponse);
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

        // Try fallback to Web Speech API
        try {
          const utterance = new SpeechSynthesisUtterance(finalResponse);
          window.speechSynthesis.speak(utterance);
        } catch (fallbackError) {
          console.error('Fallback synthesis failed:', fallbackError);
        }
      }
    } catch (error) {
      console.error('Response handling error:', error);
      setStatus(response);
    }
  };

  useEffect(() => {
    setIsSupported(voiceRecognition.isSupported());

    // Initialize voice synthesis on component mount
    const initializeVoice = async () => {
      try {
        // Load voice settings
        const response = await fetch('/api/settings/voice');
        if (response.ok) {
          const { config } = await response.json();
          setProvider(config.provider);
          setVoiceEnabled(config.voiceEnabled);
          setPitch([config.pitch]);
          setRate([config.rate]);
          setVolume([config.volume]);
        }
      } catch (error) {
        console.error('Failed to load voice settings:', error);
      }
    };

    initializeVoice();

    const setupVoiceRecognition = () => {
      voiceRecognition.on<WakeWordEvent>('wakeWord', async (event) => {
        console.log('Wake word event received:', event);
        await soundEffects.playWakeWord();
        setMode(event.mode);
        console.log('Mode set to:', event.mode);
        setStatus(event.mode === 'order' ? "Listening for order..." : "How can I help you?");
      });

      let processingTimeout: NodeJS.Timeout;
      let lastProcessedCommand = '';
      let lastProcessedTime = 0;
      let isProcessingCommand = false;

      voiceRecognition.on<string>('speech', async (text) => {
        console.log('Raw speech input received:', text);

        // Normalize the text for wake word detection
        const normalizedText = text.toLowerCase().trim();

        // Check if we're in training mode first
        if (voiceTraining.isInTraining()) {
          const handled = await voiceTraining.handleVoiceInput(normalizedText);
          if (handled) return;
        }

        // Enhanced wake word detection
        const isInquiryWake = normalizedText.includes('hey bev');
        const isOrderWake = normalizedText.includes('hey bar');

        if (isInquiryWake) {
          console.log('Inquiry wake word detected ("hey bev")');
          setMode('inquiry');
          realtimeVoiceSynthesis.setMode('inquiry');
        } else if (isOrderWake) {
          console.log('Order wake word detected ("hey bar")');
          setMode('order');
          realtimeVoiceSynthesis.setMode('order');
        }
        if (!text) {
          console.error('Received empty speech text');
          await soundEffects.playError();
          setStatus("Sorry, I didn't hear anything");
          return;
        }

        clearTimeout(processingTimeout);

        const now = Date.now();
        // Create a more robust command hash that includes the entire command and timestamp
        const commandHash = `${text.trim()}-${Math.floor(now / 1000)}`;

        // Skip if this exact command was processed in the last second
        if (commandHash === lastProcessedCommand) {
          console.log('Skipping duplicate command (processed within last second)');
          return;
        }

        // Skip if any command is currently being processed
        if (isProcessingCommand) {
          console.log('Skipping command - another command is being processed');
          return;
        }

        // Clear any pending timeout
        if (processingTimeout) {
          clearTimeout(processingTimeout);
        }

        processingTimeout = setTimeout(async () => {
          try {
            isProcessingCommand = true;
            lastProcessedCommand = commandHash;
            lastProcessedTime = now;

            console.log('Processing speech:', {
              text,
              timestamp: new Date(now).toISOString(),
              commandHash
            });

            setIsProcessing(true);
            await soundEffects.playListeningStop();
            await processVoiceInput(text);
          } catch (error) {
            console.error('Error processing voice command:', error);
          } finally {
            isProcessingCommand = false;
            setIsProcessing(false);
            // Reset the last processed command after a delay
            setTimeout(() => {
              if (lastProcessedCommand === commandHash) {
                lastProcessedCommand = '';
              }
            }, 1000);
          }
        }, 500); // Increased debounce time to 500ms
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
      const normalizedText = text.toLowerCase().trim();

      // Simple command matching
      if (normalizedText.includes('add') || normalizedText.includes('order')) {
        // Extract quantity and drink name
        const words = normalizedText.split(' ');
        let quantity = 1;
        let drinkName = '';

        for (let i = 0; i < words.length; i++) {
          // Try to parse number words or digits
          const num = parseInt(words[i]);
          if (!isNaN(num)) {
            quantity = num;
            drinkName = words.slice(i + 1).join(' ');
            break;
          } else if (words[i] === 'a' || words[i] === 'an') {
            quantity = 1;
            drinkName = words.slice(i + 1).join(' ');
            break;
          }
        }

        if (drinkName) {
          const drink = findBestMatch(drinkName, drinks);
          if (drink) {
            onAddToCart(drink, quantity);
            await soundEffects.playSuccess();
            await handleResponse(`Added ${quantity} ${drink.name} to your order.`);
          } else {
            await soundEffects.playError();
            await handleResponse(`Sorry, I couldn't find ${drinkName} in our menu.`);
          }
        } else {
          await handleResponse("What would you like to order?");
        }
      } else if (normalizedText.includes('what') || normalizedText.includes('how') || normalizedText.includes('tell')) {
        // Simple query responses
        if (normalizedText.includes('menu') || normalizedText.includes('drinks')) {
          await handleResponse("We have a variety of drinks including beers, cocktails, and non-alcoholic beverages. What type interests you?");
        } else if (normalizedText.includes('beer') || normalizedText.includes('beers')) {
          await handleResponse("We have several beers including light beers, ales, and lagers. Would you like to know specific brands?");
        } else if (normalizedText.includes('cocktail') || normalizedText.includes('cocktails')) {
          await handleResponse("Our cocktail selection includes classics and signature drinks. Would you like to hear some options?");
        } else {
          await handleResponse("Could you please be more specific about what you'd like to know?");
        }
      } else if (normalizedText.includes('hello') || normalizedText.includes('hi')) {
        await handleResponse("Hello! How can I help you today?");
      } else {
        await handleResponse("I'm not sure what you'd like. You can ask about our menu or place an order.");
      }
    } catch (error) {
      console.error("Error processing voice command:", error);
      await soundEffects.playError();
      await handleResponse("Sorry, I had trouble processing that request. Could you please repeat?");
    }

    setTimeout(() => {
      if (isListening) {
        setStatus("Say 'hey bar' to order drinks or 'hey bev' to ask questions.");
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
    <div className="flex flex-col gap-4 mb-6">
      <div className="flex items-center gap-4">
        <Button
          onClick={() => {
            if (!voiceTraining.isInTraining()) {
              voiceTraining.startTraining();
              setMode('training');
              setShowTraining(true);
            } else {
              voiceTraining.stopTraining();
              setMode('order');
              setShowTraining(false);
            }
          }}
          variant="outline"
          className="w-40"
        >
          {voiceTraining.isInTraining() ? "Stop Training" : "Start Training"}
        </Button>
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