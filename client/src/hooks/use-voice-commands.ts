import { useState, useEffect, useCallback } from 'react';
import { googleVoiceService } from '@/lib/google-voice-service';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { voiceSynthesis } from '@/lib/voice-synthesis';

type VoiceId = "alloy" | "echo" | "fable" | "onyx" | "shimmer";

interface VoiceCommandsProps {
  drinks: Array<{
    id: number;
    name: string;
    price: number;
    category: string;
  }>;
  cart: Array<{ 
    drink: { id: number; name: string; price: number; }; 
    quantity: number; 
  }>;
  onAddToCart: (action: { type: 'ADD_ITEM'; drink: any; quantity: number }) => void;
  onRemoveItem: (drinkId: number) => void;
  onPlaceOrder: () => void;
}

export function useVoiceCommands({
  drinks = [],
  cart = [],
  onAddToCart,
  onRemoveItem,
  onPlaceOrder
}: VoiceCommandsProps) {
  const [isListening, setIsListening] = useState(false);
  const { toast } = useToast();
  const [location, navigate] = useLocation();
  const [lastCommand, setLastCommand] = useState<{ text: string; timestamp: number }>({ text: '', timestamp: 0 });
  const [lastResponse, setLastResponse] = useState<string>("");
  const COMMAND_DEBOUNCE_MS = 1000; // Prevent duplicate commands within 1 second

  // Helper function to speak and remember response
  const respondWith = useCallback(async (
    message: string, 
    voice: VoiceId = "alloy", 
    emotion: "neutral" | "excited" | "apologetic" = "neutral"
  ) => {
    setLastResponse(message);
    try {
      await voiceSynthesis.speak(message, voice, emotion);
    } catch (error) {
      console.error('Error speaking response:', error);
    }
  }, []);

  // Find matching drink by name with improved matching
  const findDrink = useCallback((name: string) => {
    const normalizedInput = name.toLowerCase().trim();
    console.log('Searching for drink:', {
      input: normalizedInput,
      availableDrinks: drinks.map(d => d.name.toLowerCase())
    });
    
    // First try exact match
    const exactMatch = drinks.find(d => 
      d.name.toLowerCase() === normalizedInput
    );
    
    if (exactMatch) {
      console.log('Found exact match:', exactMatch.name);
      return exactMatch;
    }
    
    // Then try partial matches
    const partialMatch = drinks.find(d => 
      d.name.toLowerCase().includes(normalizedInput) ||
      normalizedInput.includes(d.name.toLowerCase())
    );
    
    if (partialMatch) {
      console.log('Found partial match:', partialMatch.name);
      return partialMatch;
    }
    
    console.log('No drink match found for:', normalizedInput);
    return null;
  }, [drinks]);

  const handleVoiceCommand = useCallback(async (text: string) => {
    if (!text) return;

    const command = text.toLowerCase().trim();
    const now = Date.now();
    
    console.log('Processing voice command:', {
      command,
      timestamp: now,
      lastCommand,
      hasAddToCart: !!onAddToCart,
      cartSize: cart.length,
      availableDrinks: drinks.length
    });

    // Prevent duplicate commands within the debounce window
    if (command === lastCommand.text && now - lastCommand.timestamp < COMMAND_DEBOUNCE_MS) {
      console.log('Skipping duplicate command:', command);
      return;
    }

    setLastCommand({ text: command, timestamp: now });
    console.log('Processing voice command:', command);

    // Voice command patterns
    const patterns = {
      navigation: /(?:go to|open|navigate to|show) (home|dashboard|inventory|events|settings)/i,
      addDrink: /(?:add|order|get me|i want|i would like|i'd like|give me) (?:a |an )?([a-zA-Z\s]+)/i,
      removeDrink: /(?:remove|delete|cancel|take out) (?:a |an )?([a-zA-Z\s]+)/i,
      modifyQuantity: /(?:make that|change to|update to) (\d+) ([a-zA-Z\s]+)/i,
      checkDrink: /(?:what is|tell me about|how much is|price of) (?:a |an )?([a-zA-Z\s]+)/i,
      confirmOrder: /(?:confirm|complete|finish|place) (?:the |my )?order/i,
      cancelOrder: /(?:cancel|void|clear) (?:the |my )?order/i,
      help: /(?:help|what can I say|commands|menu|what can you do)/i,
      repeatLast: /(?:repeat that|say that again|what did you say)/i
    };

    // Help command
    if (patterns.help.test(command)) {
      const helpMessage = "You can order drinks by saying 'I want a [drink name]', modify orders with 'make that 2 [drink name]', ask about drinks with 'tell me about [drink name]', or complete your order by saying 'confirm order'. You can also navigate pages by saying 'go to [page name]'.";
      await respondWith(helpMessage, "fable", "excited");
      
      toast({
        title: "Voice Commands Help",
        description: "Try saying: 'I want a [drink]', 'tell me about [drink]', or 'confirm order'",
        duration: 5000,
      });
      return;
    }

    // Add drink to order
    const addMatch = command.match(patterns.addDrink);
    if (addMatch) {
      const drinkName = addMatch[1];
      const drink = findDrink(drinkName);
      
      if (drink) {
        try {
          console.log('Adding drink to cart:', {
            drinkName: drink.name,
            drinkId: drink.id,
            price: drink.price
          });
          
          if (typeof onAddToCart !== 'function') {
            throw new Error('onAddToCart is not properly initialized');
          }
          
          onAddToCart({ type: 'ADD_ITEM', drink, quantity: 1 });
          
          await respondWith(
            `Added one ${drink.name} to your order. The price is $${drink.price}. Would you like anything else?`,
            "fable",
            "excited"
          );
          
          toast({
            title: "Added to Cart",
            description: `Added ${drink.name} to your order`,
          });
        } catch (error) {
          console.error('Error adding drink to cart:', error);
          await respondWith(
            `I'm sorry, I encountered an error adding ${drink.name} to your cart. Please try again.`,
            "shimmer",
            "apologetic"
          );
        }
      } else {
        // Find similar drinks by category
        const category = drinkName.toLowerCase().includes('cooler') ? 'Classics' :
                        drinkName.toLowerCase().includes('beer') ? 'Beer' :
                        drinkName.toLowerCase().includes('wine') ? 'Wine' : null;
        
        let suggestions = '';
        if (category) {
          const similarDrinks = drinks
            .filter(d => d.category === category)
            .slice(0, 3)
            .map(d => d.name)
            .join(', ');
          if (similarDrinks) {
            suggestions = ` Some available ${category} options are: ${similarDrinks}.`;
          }
        }

        await respondWith(
          `I apologize, but I couldn't find a drink called "${drinkName}" in our menu.${suggestions} Would you like to hear more options?`,
          "shimmer",
          "apologetic"
        );
      }
      return;
    }

    // Check drink information
    const checkMatch = command.match(patterns.checkDrink);
    if (checkMatch) {
      const drinkName = checkMatch[1];
      const drink = findDrink(drinkName);
      
      if (drink) {
        await respondWith(
          `${drink.name} is $${drink.price}. It's from our ${drink.category} collection. Would you like to order one?`,
          "alloy",
          "neutral"
        );
      } else {
        await respondWith(
          `I couldn't find information about ${drinkName}. Would you like to hear our available options?`,
          "shimmer",
          "apologetic"
        );
      }
      return;
    }

    // Modify quantity
    const quantityMatch = command.match(patterns.modifyQuantity);
    if (quantityMatch) {
      const quantity = parseInt(quantityMatch[1]);
      const drinkName = quantityMatch[2];
      const drink = findDrink(drinkName);
      
      if (drink) {
        onRemoveItem(drink.id);
        onAddToCart({ type: 'ADD_ITEM', drink, quantity });
        await respondWith(
          `Updated your order to ${quantity} ${drink.name}${quantity > 1 ? 's' : ''}. Anything else?`,
          "fable",
          "excited"
        );
      } else {
        await respondWith(
          `I couldn't find ${drinkName} in our menu. Would you like to hear our available options?`,
          "shimmer",
          "apologetic"
        );
      }
      return;
    }

    // Remove drink
    const removeMatch = command.match(patterns.removeDrink);
    if (removeMatch) {
      const drinkName = removeMatch[1];
      const drink = findDrink(drinkName);
      
      if (drink) {
        onRemoveItem(drink.id);
        await respondWith(
          `Removed ${drink.name} from your order. Is there anything else you'd like?`,
          "alloy",
          "neutral"
        );
      } else {
        await respondWith(
          `I couldn't find ${drinkName} in your order. What would you like to do?`,
          "shimmer",
          "apologetic"
        );
      }
      return;
    }

    // Confirm order
    if (patterns.confirmOrder.test(command)) {
      if (cart.length === 0) {
        await respondWith(
          "Your order is empty. Would you like to add some drinks?",
          "shimmer",
          "apologetic"
        );
      } else {
        const total = cart.reduce((sum, item) => sum + (Number(item.drink.price) * item.quantity), 0);
        await respondWith(
          `Your order total is $${total.toFixed(2)}. Processing your order now.`,
          "fable",
          "excited"
        );
        onPlaceOrder();
      }
      return;
    }

    // Cancel order
    if (patterns.cancelOrder.test(command)) {
      if (cart.length === 0) {
        await respondWith(
          "Your order is already empty. Would you like to start a new order?",
          "alloy",
          "neutral"
        );
      } else {
        cart.forEach(item => onRemoveItem(item.drink.id));
        await respondWith(
          "I've cleared your order. Would you like to start a new one?",
          "alloy",
          "neutral"
        );
      }
      return;
    }

    // Navigation handling
    const navMatch = command.match(patterns.navigation);
    if (navMatch) {
      const page = navMatch[1].toLowerCase();
      const routes: Record<string, string> = {
        home: '/',
        dashboard: '/dashboard',
        inventory: '/inventory',
        events: '/events',
        settings: '/settings'
      };
      
      if (routes[page]) {
        const response = `Navigating to ${page}`;
        await respondWith(response, "alloy", "neutral");
        navigate(routes[page]);
        toast({
          title: "Navigation",
          description: response,
        });
        return;
      }
    }

    // Repeat last response
    if (patterns.repeatLast.test(command)) {
      if (lastResponse) {
        await respondWith(lastResponse, "alloy", "neutral");
      } else {
        await respondWith(
          "I don't have anything to repeat yet. How can I help you?",
          "alloy",
          "neutral"
        );
      }
      return;
    }

    // Feedback for unrecognized command
    const response = `I heard you say: ${text}. I apologize, but I don't recognize this command. Try saying 'help' to learn what I can do.`;
    await respondWith(response, "shimmer", "apologetic");
    
    toast({
      title: "Voice Command Received",
      description: text,
    });
  }, [navigate, toast, findDrink, respondWith, cart, lastCommand, lastResponse, onAddToCart, onRemoveItem, onPlaceOrder]);

  const startListening = useCallback(async () => {
    console.log('Attempting to start voice recognition...');
    try {
      if (!googleVoiceService.isSupported()) {
        console.warn('Speech recognition not supported');
        toast({
          title: "Error",
          description: "Speech recognition is not supported in this browser.",
          variant: "destructive",
        });
        return;
      }

      console.log('Speech recognition supported, initializing...');
      await googleVoiceService.startListening(handleVoiceCommand);
      
      setIsListening(true);
      console.log('Voice recognition started successfully');
      
      try {
        await voiceSynthesis.speak(
          "Voice commands activated. I'm listening and ready to help!",
          "fable",
          "excited"
        );
      } catch (synthError) {
        console.error('Error with voice synthesis, falling back to text only:', synthError);
      }
      
      toast({
        title: "Voice Commands Active",
        description: "Listening for your commands...",
      });
    } catch (error: any) {
      console.error('Failed to start voice commands:', error);
      setIsListening(false);
      
      const errorMessage = error.message || "Failed to start voice recognition. Please check microphone permissions.";
      console.error('Voice command error details:', errorMessage);
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  }, [handleVoiceCommand, toast]);

  const stopListening = useCallback(async () => {
    try {
      await googleVoiceService.stopListening();
      setIsListening(false);
      
      voiceSynthesis.speak("Voice commands deactivated.")
        .catch(error => console.error('Error speaking deactivation message:', error));
      
      toast({
        title: "Voice Commands Stopped",
        description: "Voice recognition is now inactive.",
      });
    } catch (error: any) {
      console.error('Failed to stop voice commands:', error);
      setIsListening(false);
      toast({
        title: "Error",
        description: error.message || "Failed to stop voice recognition",
        variant: "destructive",
      });
    }
  }, [toast]);

  useEffect(() => {
    let mounted = true;

    return () => {
      mounted = false;
      if (isListening) {
        googleVoiceService.stopListening().catch(error => {
          console.error('Error during voice command cleanup:', error);
        });
      }
    };
  }, [isListening]);

  return {
    isListening,
    startListening,
    stopListening,
    isSupported: googleVoiceService.isSupported()
  };
}
