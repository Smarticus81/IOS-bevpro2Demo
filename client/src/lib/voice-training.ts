import { realtimeVoiceSynthesis } from './voice-realtime';
import { soundEffects } from './sound-effects';

export type TrainingStep = {
  instruction: string;
  expectedCommand: string;
  validation: (text: string) => boolean;
  feedback: string;
};

class VoiceTraining {
  private static instance: VoiceTraining;
  private currentStep: number = 0;
  private isTraining: boolean = false;
  private trainingSteps: TrainingStep[] = [
    {
      instruction: "Let's start with a basic greeting. Try saying 'Hey bar' to start ordering drinks.",
      expectedCommand: "hey bar",
      validation: (text: string) => text.toLowerCase().includes("hey bar"),
      feedback: "Great! 'Hey bar' puts the system in order mode. You can now order drinks."
    },
    {
      instruction: "Now let's try ordering a drink. Say 'I want two beers' or 'Add two beers'.",
      expectedCommand: "i want two beers",
      validation: (text: string) => {
        const normalized = text.toLowerCase();
        return (normalized.includes("want") || normalized.includes("add")) && 
               normalized.includes("two") && 
               normalized.includes("beer");
      },
      feedback: "Perfect! You can specify quantities and drinks in your order."
    },
    {
      instruction: "To ask questions about drinks, say 'Hey bev' followed by your question.",
      expectedCommand: "hey bev",
      validation: (text: string) => text.toLowerCase().includes("hey bev"),
      feedback: "Excellent! 'Hey bev' puts the system in inquiry mode where you can ask questions."
    },
    {
      instruction: "Try asking about our drink selection with 'What beers do you have?'",
      expectedCommand: "what beers do you have",
      validation: (text: string) => {
        const normalized = text.toLowerCase();
        return normalized.includes("what") && 
               normalized.includes("beer") && 
               normalized.includes("have");
      },
      feedback: "Great job! You can ask about any category of drinks we offer."
    }
  ];

  private constructor() {}

  static getInstance(): VoiceTraining {
    if (!VoiceTraining.instance) {
      VoiceTraining.instance = new VoiceTraining();
    }
    return VoiceTraining.instance;
  }

  async startTraining() {
    if (this.isTraining) return;
    
    this.isTraining = true;
    this.currentStep = 0;
    await this.announceCurrentStep();
  }

  async stopTraining() {
    this.isTraining = false;
    this.currentStep = 0;
    await realtimeVoiceSynthesis.speak("Training session ended. You can now use the voice ordering system!");
  }

  async handleVoiceInput(text: string): Promise<boolean> {
    if (!this.isTraining) return false;

    const currentStep = this.trainingSteps[this.currentStep];
    if (!currentStep) return false;

    const isValid = currentStep.validation(text);
    
    if (isValid) {
      await soundEffects.playSuccess();
      await realtimeVoiceSynthesis.speak(currentStep.feedback);
      
      this.currentStep++;
      
      if (this.currentStep >= this.trainingSteps.length) {
        await this.stopTraining();
        return true;
      }
      
      await this.announceCurrentStep();
      return true;
    } else {
      await soundEffects.playError();
      await realtimeVoiceSynthesis.speak(`Let's try that again. ${currentStep.instruction}`);
      return true;
    }
  }

  private async announceCurrentStep() {
    const step = this.trainingSteps[this.currentStep];
    if (step) {
      await realtimeVoiceSynthesis.speak(step.instruction);
    }
  }

  isInTraining(): boolean {
    return this.isTraining;
  }

  getCurrentStep(): number {
    return this.currentStep;
  }
}

export const voiceTraining = VoiceTraining.getInstance();
