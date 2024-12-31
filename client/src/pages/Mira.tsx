import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { NavBar } from "@/components/NavBar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mic, Send, RefreshCw, Database } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Drink } from "@db/schema";

interface Message {
  role: 'assistant' | 'user' | 'system';
  content: string;
  timestamp: number;
}

interface MiraState {
  context: string;
  messages: Message[];
  isProcessing: boolean;
  isListening: boolean;
  currentTask: string | null;
}

export function Mira() {
  const [state, setState] = useState<MiraState>({
    context: '',
    messages: [],
    isProcessing: false,
    isListening: false,
    currentTask: null
  });
  const [input, setInput] = useState('');

  // Fetch inventory data
  const { data: inventory = [], refetch: refetchInventory } = useQuery<Drink[]>({
    queryKey: ["/api/drinks"],
  });

  const handleSend = async () => {
    if (!input.trim()) return;

    setState(prev => ({
      ...prev,
      messages: [...prev.messages, {
        role: 'user',
        content: input,
        timestamp: Date.now()
      }],
      isProcessing: true
    }));

    setInput('');
    
    // API call will be implemented in next iteration
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
                <ScrollArea className="flex-grow mb-4 pr-4">
                  <AnimatePresence mode="popLayout">
                    {state.messages.map((message, index) => (
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
                  </AnimatePresence>
                </ScrollArea>

                {/* Input Area */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    onClick={() => setState(prev => ({ ...prev, isListening: !prev.isListening }))}
                  >
                    <Mic className={`h-4 w-4 ${state.isListening ? 'text-red-500' : ''}`} />
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
