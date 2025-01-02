import { Router } from 'express';
import { db } from '@db';
import { voiceTutorialProgress } from '@db/schema';
import { z } from 'zod';
import session from 'express-session';
import MemoryStore from 'memorystore';

const router = Router();
const MemoryStoreSession = MemoryStore(session);

// Configure session middleware
router.use(session({
  cookie: { maxAge: 86400000 },
  store: new MemoryStoreSession({
    checkPeriod: 86400000 // prune expired entries every 24h
  }),
  resave: false,
  saveUninitialized: false,
  secret: process.env.SESSION_SECRET || 'development_secret'
}));

// Schema for tutorial progress
const progressSchema = z.object({
  userId: z.string(),
  completedSteps: z.array(z.string()),
  accuracy: z.number().min(0).max(100),
  lastCompletedAt: z.string().datetime()
});

// Get tutorial content and user progress
router.get('/api/voice-tutorial/content', async (req, res) => {
  try {
    const tutorialContent = {
      sections: [
        {
          id: 'basics',
          title: 'Basic Commands',
          description: 'Learn the fundamental voice commands',
          commands: [
            {
              intent: 'wake_word',
              examples: ['Hey Bar', 'Hey Bev'],
              description: 'Start voice recognition'
            },
            {
              intent: 'help',
              examples: ['What can I say?', 'Show commands'],
              description: 'Get help with available commands'
            }
          ]
        },
        {
          id: 'ordering',
          title: 'Ordering Drinks',
          description: 'Practice placing drink orders',
          commands: [
            {
              intent: 'add_drink',
              examples: ['I would like a mojito', 'Get me two margaritas'],
              description: 'Add drinks to your order'
            },
            {
              intent: 'modify_order',
              examples: ['Make that three', 'Change to large size'],
              description: 'Modify your current order'
            }
          ]
        }
      ],
      userProgress: null
    };

    // If user is authenticated, fetch their progress
    if (req.session.userId) {
      const progress = await db.query.voiceTutorialProgress.findFirst({
        where: { userId: req.session.userId }
      });
      tutorialContent.userProgress = progress;
    }

    res.json(tutorialContent);
  } catch (error) {
    console.error('Error fetching tutorial content:', error);
    res.status(500).json({ error: 'Failed to fetch tutorial content' });
  }
});

// Process tutorial command
router.post('/api/voice-tutorial/process-command', async (req, res) => {
  try {
    const { command, currentStep } = req.body;

    // Validate command against current tutorial step
    const result = await processAndValidateCommand(command, currentStep);

    // Update user progress if authenticated
    if (req.session.userId && result.success) {
      await db.insert(voiceTutorialProgress).values({
        userId: req.session.userId,
        completedSteps: [currentStep],
        accuracy: result.accuracy,
        lastCompletedAt: new Date().toISOString(),
        metadata: {
          commandHistory: [{
            command,
            timestamp: Date.now(),
            success: true
          }],
          preferences: {
            difficulty: 'normal',
            voiceSpeed: 1,
            requireConfirmation: true
          }
        }
      });
    }

    res.json(result);
  } catch (error) {
    console.error('Error processing tutorial command:', error);
    res.status(500).json({ error: 'Failed to process command' });
  }
});

// Helper function to process and validate commands
async function processAndValidateCommand(command: string, step: string) {
  const commandLower = command.toLowerCase();
  const result = {
    success: false,
    accuracy: 0,
    feedback: '',
    nextStep: step
  };

  switch (step) {
    case 'wake_word':
      if (commandLower.includes('hey bar') || commandLower.includes('hey bev')) {
        result.success = true;
        result.accuracy = 100;
        result.feedback = 'Perfect! You\'ve mastered the wake word.';
        result.nextStep = 'basic_commands';
      } else {
        result.feedback = 'Try saying "Hey Bar" or "Hey Bev"';
        result.accuracy = 0;
      }
      break;

    case 'ordering':
      if (commandLower.includes('would like') || commandLower.includes('get me')) {
        result.success = true;
        result.accuracy = 90;
        result.feedback = 'Great job placing an order!';
        result.nextStep = 'modifying_orders';
      } else {
        result.feedback = 'Try saying "I would like a [drink]" or "Get me a [drink]"';
        result.accuracy = 30;
      }
      break;

    default:
      result.feedback = 'Unknown tutorial step';
  }

  return result;
}

export default router;