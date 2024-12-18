import { motion, AnimatePresence } from "framer-motion";
import { Wine } from "lucide-react";
import { useEffect, useState } from "react";
import { soundEffects } from "@/lib/sound-effects";

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [stage, setStage] = useState<number>(0);
  
  useEffect(() => {
    let mounted = true;
    
    const animate = async () => {
      try {
        // Play a welcome sound if available
        try {
          await soundEffects.playWakeWord();
        } catch (error) {
          console.warn('Sound effect playback failed:', error);
        }
        
        // Sequence the animations with cleanup check
        if (mounted) {
          await new Promise(resolve => setTimeout(resolve, 500));
          setStage(1); // Logo appears
        }
        
        if (mounted) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          setStage(2); // Tagline appears
        }
        
        if (mounted) {
          await new Promise(resolve => setTimeout(resolve, 1500));
          setStage(3); // Start button appears
        }
      } catch (error) {
        console.error('Animation sequence failed:', error);
      }
    };
    
    animate();
    
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        className="fixed inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-pearl-light to-pearl-dark"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="text-center space-y-8">
          {/* Logo Animation */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ 
              scale: stage >= 1 ? 1 : 0.5, 
              opacity: stage >= 1 ? 1 : 0,
            }}
            className="flex flex-col items-center"
          >
            <div className="p-4 rounded-full bg-gradient-to-r from-mint to-lavender">
              <Wine className="h-16 w-16 text-white" />
            </div>
            <motion.h1 
              className="text-4xl font-bold mt-4 bg-gradient-to-r from-mint to-lavender bg-clip-text text-transparent"
              initial={{ y: 20 }}
              animate={{ y: stage >= 1 ? 0 : 20 }}
            >
              BevPro
            </motion.h1>
          </motion.div>

          {/* Tagline Animation */}
          <motion.p
            className="text-xl text-navy/80"
            initial={{ opacity: 0, y: 20 }}
            animate={{ 
              opacity: stage >= 2 ? 1 : 0,
              y: stage >= 2 ? 0 : 20
            }}
            transition={{ delay: 0.2 }}
          >
            Your AI-Powered Beverage Assistant
          </motion.p>

          {/* Start Button Animation */}
          <motion.button
            className="mt-8 px-8 py-3 rounded-full bg-gradient-to-r from-mint to-lavender text-white font-semibold 
                     shadow-lg hover:shadow-xl transform transition-all hover:-translate-y-1"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ 
              opacity: stage >= 3 ? 1 : 0,
              scale: stage >= 3 ? 1 : 0.9
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onComplete}
          >
            Get Started
          </motion.button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
