import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Mic, Volume2, Settings, HelpCircle, Play } from "lucide-react";
import { motion } from "framer-motion";
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
          "Remove the last drink",
          "Take that off",
          "Never mind the margarita",
          "Delete that last one",
          "Get rid of the beer"
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
          "Split payment",
          "Share the check",
          "Split it evenly"
        ]
      },
      {
        intent: "apply_discount",
        examples: [
          "Apply happy hour discount",
          "Use my coupon",
          "Add employee discount",
          "Apply promotion",
          "Use discount code"
        ]
      },
      {
        intent: "complete_order",
        examples: [
          "Complete the order",
          "Finish up",
          "Process payment",
          "Check out",
          "That's everything"
        ]
      }
    ]
  }
};

function CommandExampleCard({ intent, examples }: { intent: string; examples: string[] }) {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const tryCommand = async (command: string) => {
    setIsProcessing(true);
    try {
      const result = await processVoiceOrder(command);
      if (result.success) {
        toast({
          title: "Command Processed",
          description: result.order?.naturalLanguageResponse?.suggestedResponse || "Command executed successfully",
          variant: "default"
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
    }
  };

  return (
    <Card className="mb-4 bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border-white/20 
                    shadow-lg hover:shadow-xl transition-all duration-300
                    rounded-xl overflow-hidden">
      <CardHeader className="bg-gradient-to-br from-primary/5 to-primary/10
                           dark:from-primary/10 dark:to-primary/20">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg capitalize text-primary flex items-center gap-2">
            <Badge variant="secondary" className="rounded-lg">
              {intent.split('_').join(' ')}
            </Badge>
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {examples.map((example, index) => (
            <motion.li
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex items-center justify-between gap-2 p-2 rounded-lg
                       hover:bg-gray-50 dark:hover:bg-gray-800/50
                       transition-all duration-200"
            >
              <span className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <Mic className="h-4 w-4 text-primary/60" />
                "{example}"
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => tryCommand(example)}
                disabled={isProcessing}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Play className="h-4 w-4" />
              </Button>
            </motion.li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export default function VoiceTutorialPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 
                    dark:from-gray-900 dark:to-gray-800">
      <NavBar />
      <div className="p-6 pt-20">
        <div className="max-w-4xl mx-auto">
          <motion.header 
            className="text-center mb-8"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4
                         bg-clip-text text-transparent bg-gradient-to-r 
                         from-primary to-primary/70">
              Voice Command Tutorial
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Learn how to use voice commands effectively with our POS system.
              Explore different categories and try example phrases for each command type.
            </p>
          </motion.header>

          <Tabs defaultValue="system" className="w-full">
            <TabsList className="grid grid-cols-4 gap-4 bg-transparent mb-8">
              {Object.entries(commandCategories).map(([key, category]) => (
                <TabsTrigger
                  key={key}
                  value={key}
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground
                           bg-white/50 dark:bg-gray-800/50 backdrop-blur-xl
                           border border-gray-200/20 dark:border-gray-700/20
                           shadow-lg rounded-xl"
                >
                  {category.name}
                </TabsTrigger>
              ))}
            </TabsList>

            {Object.entries(commandCategories).map(([key, category]) => (
              <TabsContent key={key} value={key}>
                <motion.div 
                  className="mb-6"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                    {category.name}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">{category.description}</p>
                </motion.div>

                <ScrollArea className="h-[600px] pr-4">
                  <div className="space-y-4">
                    {category.commands.map((command) => (
                      <CommandExampleCard
                        key={command.intent}
                        intent={command.intent}
                        examples={command.examples}
                      />
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
            ))}
          </Tabs>

          <motion.div 
            className="mt-8 flex justify-center gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Button variant="outline" className="gap-2 bg-white/50 dark:bg-gray-800/50 
                                             backdrop-blur-xl shadow-lg rounded-xl">
              <Settings className="h-4 w-4" />
              Voice Settings
            </Button>
            <Button variant="outline" className="gap-2 bg-white/50 dark:bg-gray-800/50 
                                             backdrop-blur-xl shadow-lg rounded-xl">
              <Volume2 className="h-4 w-4" />
              Test Commands
            </Button>
            <Button variant="outline" className="gap-2 bg-white/50 dark:bg-gray-800/50 
                                             backdrop-blur-xl shadow-lg rounded-xl">
              <HelpCircle className="h-4 w-4" />
              Get Help
            </Button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}