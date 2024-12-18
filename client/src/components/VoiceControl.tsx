import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mic, MicOff } from "lucide-react";
import { voiceRecognition } from "@/lib/voice";
import { voiceTraining } from "@/lib/voice-training";
import { processVoiceCommand } from "@/lib/openai";
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
            await processVoiceInput(text);
          } finally {
            isProcessingCommand = false;
            setIsProcessing(false);
          }
        }, 300);
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

          // Handle response based on mode
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
          if (mode === 'inquiry') {
            await handleResponse(intent.conversational_response);
          }
          break;
        }

        case "query": {
          try {
            if (intent.conversational_response?.trim()) {
              await handleResponse(intent.conversational_response);
            } else {
              console.log('Empty response, skipping voice synthesis');
            }
          } catch (error) {
            console.error('Failed to handle query response:', error);
            await soundEffects.playError();
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