import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { NavBar } from "@/components/NavBar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mic, Send, RefreshCw, Volume2, VolumeX } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Drink } from "@db/schema";
import { miraService } from '@/lib/mira-service';
import { useToast } from "@/hooks/use-toast";

interface Message {
  role: 'assistant' | 'user' | 'system';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

interface MiraState {
  context: string;
  messages: Message[];
  isProcessing: boolean;
  isListening: boolean;
  currentTask: string | null;
  voiceEnabled: boolean;
}

// Get the correct SpeechRecognition constructor
const SpeechRecognitionConstructor = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition: SpeechRecognition | null = null;

if (SpeechRecognitionConstructor) {
  recognition = new SpeechRecognitionConstructor();
  recognition.continuous = false;
  recognition.interimResults = true;
}

export function Mira() {
  const { toast } = useToast();
  const [state, setState] = useState<MiraState>({
    context: '',
    messages: [],
    isProcessing: false,
    isListening: false,
    currentTask: null,
    voiceEnabled: true
  });
  const [input, setInput] = useState('');
  const [streamingMessage, setStreamingMessage] = useState<string>('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch inventory data
  const { data: inventory = [], refetch: refetchInventory } = useQuery<Drink[]>({
    queryKey: ["/api/drinks"],
  });

  useEffect(() => {
    if (!recognition) {
      toast({
        title: "Speech Recognition Unavailable",
        description: "Your browser doesn't support speech recognition.",
        variant: "destructive"
      });
      return;
    }

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = Array.from(event.results)
        .map(result => result[0])
        .map(result => result.transcript)
        .join('');

      setInput(transcript);
    };

    recognition.onend = () => {
      setState(prev => ({ ...prev, isListening: false }));
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);
      setState(prev => ({ ...prev, isListening: false }));
      toast({
        title: "Speech Recognition Error",
        description: `Error: ${event.error}`,
        variant: "destructive"
      });
    };

    return () => {
      if (recognition) {
        recognition.stop();
      }
      window.speechSynthesis.cancel();
    };
  }, [toast]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [state.messages, streamingMessage]);

  const toggleVoice = () => {
    setState(prev => ({ ...prev, voiceEnabled: !prev.voiceEnabled }));
    miraService.setVoiceEnabled(!state.voiceEnabled);
  };

  const startListening = () => {
    if (!recognition) {
      toast({
        title: "Speech Recognition Unavailable",
        description: "Your browser doesn't support speech recognition.",
        variant: "destructive"
      });
      return;
    }

    setState(prev => ({ ...prev, isListening: true }));
    recognition.start();
  };

  const stopListening = () => {
    if (recognition) {
      recognition.stop();
    }
    setState(prev => ({ ...prev, isListening: false }));
  };

  const speakResponse = (text: string, config?: { speed?: number; pitch?: number }) => {
    if (!state.voiceEnabled) return;

    window.speechSynthesis.cancel(); // Stop any current speech
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = config?.speed || 1;
    utterance.pitch = config?.pitch || 1;
    window.speechSynthesis.speak(utterance);
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: Date.now()
    };

    setState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      isProcessing: true
    }));

    setInput('');
    setStreamingMessage('');

    try {
      await miraService.processMessage(
        input,
        JSON.stringify(inventory),
        {
          onToken: (token: string) => {
            setStreamingMessage(prev => prev + token);
          },
          onComplete: (response) => {
            const assistantMessage: Message = {
              role: 'assistant',
              content: response.reply,
              timestamp: Date.now()
            };

            setState(prev => ({
              ...prev,
              messages: [...prev.messages, assistantMessage],
              isProcessing: false
            }));

            setStreamingMessage('');

            if (state.voiceEnabled && response.voiceConfig) {
              speakResponse(response.reply, {
                speed: response.voiceConfig.speed,
                pitch: response.voiceConfig.pitch
              });
            }
          },
          onError: (error: any) => {
            console.error('Streaming error:', error);
            toast({
              title: "Error",
              description: "Failed to process message. Please try again.",
              variant: "destructive"
            });
            setState(prev => ({ ...prev, isProcessing: false }));
            setStreamingMessage('');
          }
        }
      );
    } catch (error) {
      console.error('Error processing message:', error);
      toast({
        title: "Error",
        description: "Failed to process message. Please try again.",
        variant: "destructive"
      });
      setState(prev => ({ ...prev, isProcessing: false }));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <NavBar />

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Chat Interface */}
          <Card className="lg:col-span-2 bg-white/5 backdrop-blur-lg border-white/10">
            <CardContent className="p-6">
              <div className="flex flex-col h-[70vh]">
                {/* Chat Messages */}
                <ScrollArea ref={scrollRef} className="flex-grow mb-4 pr-4">
                  <AnimatePresence mode="popLayout">
                    {state.messages.map((message) => (
                      <motion.div
                        key={message.timestamp}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className={`mb-4 flex ${
                          message.role === 'assistant' ? 'justify-start' : 'justify-end'
                        }`}
                      >
                        <div
                          className={`max-w-[80%] p-4 rounded-lg ${
                            message.role === 'assistant'
                              ? 'bg-gray-800 text-white'
                              : 'bg-blue-600 text-white'
                          }`}
                        >
                          {message.content}
                        </div>
                      </motion.div>
                    ))}
                    {streamingMessage && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-4 flex justify-start"
                      >
                        <div className="max-w-[80%] p-4 rounded-lg bg-gray-800 text-white">
                          {streamingMessage}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </ScrollArea>

                {/* Input Area */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className={`shrink-0 ${state.isListening ? 'bg-red-500/10' : ''}`}
                    onClick={() => state.isListening ? stopListening() : startListening()}
                  >
                    <Mic className={`h-4 w-4 ${state.isListening ? 'text-red-500' : ''}`} />
                  </Button>

                  <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    onClick={toggleVoice}
                  >
                    {state.voiceEnabled ? (
                      <Volume2 className="h-4 w-4" />
                    ) : (
                      <VolumeX className="h-4 w-4" />
                    )}
                  </Button>

                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Ask Mira anything about inventory..."
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/50"
                  />

                  <Button
                    variant="default"
                    size="icon"
                    className="shrink-0"
                    onClick={handleSend}
                    disabled={state.isProcessing || !input.trim()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Inventory Status Panel */}
          <Card className="bg-white/5 backdrop-blur-lg border-white/10">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white">Inventory Status</h3>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => refetchInventory()}
                  className="h-8 w-8"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>

              <ScrollArea className="h-[60vh] pr-4">
                {inventory.map((item) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mb-4"
                  >
                    <div className="bg-white/5 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-white">{item.name}</h4>
                        <span className={`px-2 py-1 rounded text-xs ${
                          item.inventory < 20
                            ? 'bg-red-500/20 text-red-300'
                            : item.inventory < 50
                            ? 'bg-yellow-500/20 text-yellow-300'
                            : 'bg-green-500/20 text-green-300'
                        }`}>
                          {item.inventory} left
                        </span>
                      </div>
                      <div className="text-sm text-white/70">
                        Category: {item.category}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}