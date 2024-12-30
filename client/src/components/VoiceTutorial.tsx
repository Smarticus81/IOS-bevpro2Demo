import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mic, CheckCircle2, HelpCircle, ShoppingCart, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { soundEffects } from '@/lib/sound-effects';

interface TutorialStep {
  title: string;
  instruction: string;
  expectedCommand: string;
  icon: React.ReactNode;
  hint?: string;
}

const tutorialSteps: TutorialStep[] = [
  {
    title: 'Wake Word',
    instruction: 'Start by saying "Hey Bar" or "Hey Bev" to activate voice commands',
    expectedCommand: 'hey bar',
    icon: <Mic className="h-6 w-6" />,
    hint: 'Try saying "Hey Bar" clearly and wait for the acknowledgment'
  },
  {
    title: 'Basic Ordering',
    instruction: 'Try ordering a drink by saying something like "I\'d like a Moscow Mule"',
    expectedCommand: 'moscow mule',
    icon: <ShoppingCart className="h-6 w-6" />,
    hint: 'You can also say "Can I get a Moscow Mule" or "Add a Moscow Mule"'
  },
  {
    title: 'Multiple Items',
    instruction: 'Order multiple items by saying "I\'d like a Coors Light and two White Claws"',
    expectedCommand: 'coors light and white claw',
    icon: <ShoppingCart className="h-6 w-6" />,
    hint: 'Use "and" to separate multiple items'
  },
  {
    title: 'Help Command',
    instruction: 'Try asking for help by saying "What can I say?" or "Help"',
    expectedCommand: 'help',
    icon: <HelpCircle className="h-6 w-6" />,
    hint: 'The help command shows all available voice commands'
  },
  {
    title: 'Complete Order',
    instruction: 'Complete your order by saying "That\'s all" or "Complete order"',
    expectedCommand: 'complete order',
    icon: <CheckCircle2 className="h-6 w-6" />,
    hint: 'You can also say "Process order" or "That\'s it"'
  }
];

interface Props {
  onComplete: () => void;
  isOpen: boolean;
}

export function VoiceTutorial({ onComplete, isOpen }: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const { toast } = useToast();

  const handleStepComplete = useCallback(async () => {
    if (currentStep < tutorialSteps.length - 1) {
      await soundEffects.playSuccess();
      setCompletedSteps(prev => [...prev, currentStep]);
      setCurrentStep(prev => prev + 1);
      toast({
        title: 'Good job!',
        description: 'Moving to the next step...',
        duration: 2000,
      });
    } else {
      await soundEffects.playSuccess();
      toast({
        title: 'Tutorial Complete!',
        description: 'You\'re ready to use voice commands!',
        duration: 3000,
      });
      onComplete();
    }
  }, [currentStep, toast, onComplete]);

  const handleSkip = useCallback(async () => {
    await soundEffects.playListeningStop();
    onComplete();
  }, [onComplete]);

  if (!isOpen) return null;

  const step = tutorialSteps[currentStep];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      >
        <Card className="w-full max-w-lg mx-4 p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 p-2 bg-primary/10 rounded-full">
              {step.icon}
            </div>
            <div className="flex-grow">
              <h3 className="text-lg font-semibold mb-2">
                Step {currentStep + 1}: {step.title}
              </h3>
              <p className="text-muted-foreground mb-4">{step.instruction}</p>
              {step.hint && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                  <HelpCircle className="h-4 w-4" />
                  <p>{step.hint}</p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <div className="flex gap-2">
              {tutorialSteps.map((_, index) => (
                <div
                  key={index}
                  className={`w-2 h-2 rounded-full transition-colors duration-200 ${
                    completedSteps.includes(index)
                      ? 'bg-primary'
                      : index === currentStep
                      ? 'bg-primary/50'
                      : 'bg-border'
                  }`}
                />
              ))}
            </div>
            <Button
              variant="ghost"
              onClick={handleSkip}
              className="text-muted-foreground"
            >
              Skip Tutorial
            </Button>
          </div>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}
