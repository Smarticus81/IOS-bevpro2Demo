import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GlassWater, Mic, Play, X, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { soundEffects } from "@/lib/sound-effects";

interface TutorialStep {
  title: string;
  description: string;
  command: string;
  icon: React.ReactNode;
}

const tutorialSteps: TutorialStep[] = [
  {
    title: "Wake Word",
    description: "Start with 'Hey Bar' to place an order",
    command: "Hey Bar, I'd like...",
    icon: <Volume2 className="h-6 w-6" />
  },
  {
    title: "Order Drinks",
    description: "Say the drink name and quantity",
    command: "Hey Bar, add a Moscow Mule",
    icon: <GlassWater className="h-6 w-6" />
  },
  {
    title: "Complete Order",
    description: "Finish your order when ready",
    command: "Hey Bar, complete order",
    icon: <Play className="h-6 w-6" />
  }
];

interface VoiceTutorialProps {
  onClose: () => void;
}

export function VoiceTutorial({ onClose }: VoiceTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const playStepAudio = async () => {
    setIsPlaying(true);
    await soundEffects.playWakeWord();
    setTimeout(() => setIsPlaying(false), 500);
  };

  const nextStep = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
    >
      <Card className="relative w-full max-w-md mx-4 p-6">
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>

        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2">Voice Command Tutorial</h2>
          <p className="text-muted-foreground">
            Learn how to use voice commands to place orders effortlessly
          </p>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="mb-6"
          >
            <div className="flex items-center gap-4 mb-4">
              {tutorialSteps[currentStep].icon}
              <h3 className="text-xl font-semibold">
                {tutorialSteps[currentStep].title}
              </h3>
            </div>
            <p className="text-muted-foreground mb-4">
              {tutorialSteps[currentStep].description}
            </p>
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <Mic className="h-5 w-5 text-muted-foreground" />
              <span className="font-mono">
                {tutorialSteps[currentStep].command}
              </span>
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="flex items-center justify-between mt-6">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={prevStep}
              disabled={currentStep === 0}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              onClick={nextStep}
              disabled={currentStep === tutorialSteps.length - 1}
            >
              Next
            </Button>
          </div>
          <Button
            variant="default"
            className="bg-primary"
            onClick={playStepAudio}
            disabled={isPlaying}
          >
            Try Sound
          </Button>
        </div>

        <div className="flex justify-center mt-4">
          <div className="flex gap-1">
            {tutorialSteps.map((_, index) => (
              <motion.div
                key={index}
                className={`h-1.5 w-4 rounded-full ${
                  index === currentStep ? "bg-primary" : "bg-muted"
                }`}
                animate={{
                  scale: index === currentStep ? 1.2 : 1,
                }}
              />
            ))}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
