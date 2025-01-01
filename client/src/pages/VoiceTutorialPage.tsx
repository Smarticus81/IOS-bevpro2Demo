import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Mic, Volume2, Settings, HelpCircle } from "lucide-react";
import { motion } from "framer-motion";

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
  return (
    <Card className="mb-4 bg-white/90 backdrop-blur-sm border-white/20 shadow-lg
                    hover:shadow-xl transition-all duration-300">
      <CardHeader>
        <CardTitle className="text-lg capitalize text-primary">
          {intent.split('_').join(' ')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {examples.map((example, index) => (
            <motion.li
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex items-center gap-2 text-sm text-gray-600"
            >
              <Mic className="h-4 w-4 text-primary/60" />
              "{example}"
            </motion.li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export default function VoiceTutorialPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 p-6">
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Voice Command Tutorial
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Learn how to use voice commands effectively with our POS system.
            Explore different categories and see example phrases for each command type.
          </p>
        </header>

        <Tabs defaultValue="system" className="w-full">
          <TabsList className="grid grid-cols-4 gap-4 bg-transparent mb-8">
            {Object.entries(commandCategories).map(([key, category]) => (
              <TabsTrigger
                key={key}
                value={key}
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                {category.name}
              </TabsTrigger>
            ))}
          </TabsList>

          {Object.entries(commandCategories).map(([key, category]) => (
            <TabsContent key={key} value={key}>
              <div className="mb-6">
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                  {category.name}
                </h2>
                <p className="text-gray-600 mb-6">{category.description}</p>
              </div>

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

        <div className="mt-8 flex justify-center gap-4">
          <Button variant="outline" className="gap-2">
            <Settings className="h-4 w-4" />
            Voice Settings
          </Button>
          <Button variant="outline" className="gap-2">
            <Volume2 className="h-4 w-4" />
            Test Commands
          </Button>
          <Button variant="outline" className="gap-2">
            <HelpCircle className="h-4 w-4" />
            Get Help
          </Button>
        </div>
      </div>
    </div>
  );
}
