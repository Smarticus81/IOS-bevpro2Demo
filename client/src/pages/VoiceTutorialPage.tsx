import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Mic, Settings, HelpCircle, Play } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { processVoiceOrder } from "@/lib/voice-order-service";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { NavBar } from "@/components/NavBar";

const commandCategories = {
  system: {
    name: "System Commands",
    description: "Core system controls and help commands",
    commands: [
      {
        intent: "cancel_order",
        examples: [
          "Cancel this order",
          "Start over",
          "Forget everything",
          "You know what, let's start over",
          "Clear everything"
        ]
      },
      {
        intent: "help",
        examples: [
          "What can I order?",
          "Show me the menu",
          "What's available?",
          "How does this work?",
          "I need assistance"
        ]
      },
      {
        intent: "stop",
        examples: [
          "Stop listening",
          "That's all",
          "I'm done",
          "Exit",
          "No more"
        ]
      }
    ]
  },
  ordering: {
    name: "Ordering Commands",
    description: "Commands for adding and modifying drinks",
    commands: [
      {
        intent: "add_item",
        examples: [
          "I'd like a mojito",
          "Can I get two margaritas",
          "Let's try a Moscow Mule",
          "Give me a beer",
          "I'll have an old fashioned"
        ]
      },
      {
        intent: "modify_item",
        examples: [
          "Make that two instead",
          "Actually, make it three",
          "Change that to a large",
          "On second thought, make those doubles",
          "Instead, make it a mojito"
        ]
      },
      {
        intent: "remove_item",
        examples: [
          "Remove the mojito",
          "Take off the last drink",
          "Never mind the margarita",
          "Delete that Moscow Mule",
          "Get rid of the beer",
          "Cancel this cocktail",
          "I don't want that drink anymore"
        ]
      }
    ]
  },
  references: {
    name: "Reference Commands",
    description: "Ways to refer to previous or current items",
    commands: [
      {
        intent: "previous_reference",
        examples: [
          "Another one of those",
          "Same thing",
          "One more like that",
          "Make it two of them",
          "Get me another"
        ]
      },
      {
        intent: "current_reference",
        examples: [
          "This drink",
          "The current order",
          "What's in my cart",
          "Show me what I have",
          "What am I getting"
        ]
      }
    ]
  },
  management: {
    name: "Management Commands",
    description: "Order management and payment commands",
    commands: [
      {
        intent: "split_order",
        examples: [
          "Split this order",
          "Divide the bill",
          "Share the check",
          "Can we split the bill",
          "Split it evenly"
        ]
      },
      {
        intent: "apply_discount",
        examples: [
          "Apply happy hour discount",
          "Use my coupon",
          "Add employee discount",
          "Give me a discount",
          "Use promotion code"
        ]
      },
      {
        intent: "complete_order",
        examples: [
          "Complete the order",
          "Check out now",
          "Process payment",
          "Ready to pay",
          "That's everything"
        ]
      }
    ]
  }
};

function CommandExampleCard({ intent, examples }: { intent: string; examples: string[] }) {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeExample, setActiveExample] = useState<string | null>(null);

  const tryCommand = async (command: string) => {
    setIsProcessing(true);
    setActiveExample(command);
    try {
      const result = await processVoiceOrder(command);
      if (result.success) {
        toast({
          title: "Command Processed",
          description: result.order?.naturalLanguageResponse?.suggestedResponse || "Command executed successfully",
        });
      } else {
        toast({
          title: "Command Failed",
          description: result.error || "Failed to process command",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process command",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
      setActiveExample(null);
    }
  };

  return (
    <Card className="overflow-hidden border border-gray-100 dark:border-gray-800">
      <CardHeader className="p-4 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardTitle className="text-base sm:text-lg">
          <Badge variant="secondary" className="capitalize">
            {intent.split('_').join(' ')}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {examples.map((example, index) => (
            <motion.li
              key={index}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="group relative flex items-center min-h-[3.5rem] px-4 py-3 sm:py-2
                        hover:bg-gray-50 dark:hover:bg-gray-800/50
                        active:bg-gray-100 dark:active:bg-gray-800/70
                        transition-colors duration-200"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Mic className={`h-4 w-4 shrink-0 ${
                  activeExample === example ? 'text-primary animate-pulse' : 'text-primary/60'
                }`} />
                <span className="text-sm sm:text-base text-gray-600 dark:text-gray-400 truncate">
                  "{example}"
                </span>
              </div>

              <AnimatePresence>
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.2 }}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => tryCommand(example)}
                    disabled={isProcessing}
                    className="shrink-0 h-8 w-8 sm:w-auto sm:px-3
                             opacity-0 group-hover:opacity-100
                             focus:opacity-100
                             absolute right-2 top-1/2 -translate-y-1/2
                             sm:relative sm:right-0 sm:top-0 sm:translate-y-0
                             transition-all duration-200"
                  >
                    <Play className="h-4 w-4" />
                    <span className="hidden sm:inline ml-2">Try</span>
                  </Button>
                </motion.div>
              </AnimatePresence>
            </motion.li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export default function VoiceTutorialPage() {
  const [selectedCategory, setSelectedCategory] = useState("system");

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 
                    dark:from-gray-900 dark:to-gray-800">
      <NavBar />

      <main className="px-4 pt-20 pb-8 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <motion.header
            className="text-center mb-8"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold 
                          bg-clip-text text-transparent bg-gradient-to-r 
                          from-primary to-primary/70 mb-4">
              Voice Command Tutorial
            </h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
              Learn how to use voice commands effectively with our POS system.
              Try out different commands and explore their usage.
            </p>
          </motion.header>

          <Tabs
            value={selectedCategory}
            onValueChange={setSelectedCategory}
            className="space-y-6"
          >
            <div className="sticky top-16 z-10 -mx-4 px-4 pb-4 pt-2
                          bg-gradient-to-b from-gray-50 via-gray-50/95 to-transparent 
                          dark:from-gray-900 dark:via-gray-900/95 backdrop-blur-xl">
              <ScrollArea className="pb-2">
                <TabsList className="inline-flex min-w-full sm:min-w-0 p-1 bg-transparent">
                  {Object.entries(commandCategories).map(([key, category]) => (
                    <TabsTrigger
                      key={key}
                      value={key}
                      className="flex-none px-4 py-2.5 text-sm sm:text-base
                                data-[state=active]:bg-primary 
                                data-[state=active]:text-primary-foreground
                                bg-white/50 dark:bg-gray-800/50
                                shadow-sm hover:shadow-md
                                transition-all duration-200
                                rounded-lg mx-1 first:ml-0 last:mr-0"
                    >
                      {category.name}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </ScrollArea>
            </div>

            <div className="min-h-[calc(100vh-20rem)]">
              {Object.entries(commandCategories).map(([key, category]) => (
                <TabsContent
                  key={key}
                  value={key}
                  className="mt-0 focus-visible:outline-none focus-visible:ring-0"
                >
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="mb-6"
                  >
                    <h2 className="text-xl sm:text-2xl font-semibold 
                                text-gray-900 dark:text-white mb-2">
                      {category.name}
                    </h2>
                    <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                      {category.description}
                    </p>
                  </motion.div>

                  <div className="space-y-4">
                    {category.commands.map((command) => (
                      <CommandExampleCard
                        key={command.intent}
                        intent={command.intent}
                        examples={command.examples}
                      />
                    ))}
                  </div>
                </TabsContent>
              ))}
            </div>
          </Tabs>

          <motion.div
            className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Button
              variant="default"
              className="h-12 sm:h-10 gap-2 text-base sm:text-sm
                       bg-primary hover:bg-primary/90"
            >
              <Mic className="h-5 w-5 sm:h-4 sm:w-4" />
              Try Voice Commands
            </Button>

            <Button
              variant="outline"
              className="h-12 sm:h-10 gap-2 text-base sm:text-sm
                       bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm"
            >
              <Settings className="h-5 w-5 sm:h-4 sm:w-4" />
              Voice Settings
            </Button>

            <Button
              variant="outline"
              className="h-12 sm:h-10 gap-2 text-base sm:text-sm
                       bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm"
            >
              <HelpCircle className="h-5 w-5 sm:h-4 sm:w-4" />
              Get Help
            </Button>
          </motion.div>
        </div>
      </main>
    </div>
  );
}