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
        className="fixed inset-0 flex flex-col items-center justify-center bg-[#1e2024] overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, transition: { duration: 0.3 } }}
      >
        <div className="absolute inset-0 flex items-center justify-center opacity-20">
          <img src="/image.png" alt="BevPro Background" className="w-full h-full object-cover" />
        </div>
        <div className="text-center space-y-12 max-w-2xl mx-auto px-4 relative z-10 glass-card">
          {/* Logo Animation */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ 
              scale: stage >= 1 ? 1 : 0.5, 
              opacity: stage >= 1 ? 1 : 0,
            }}
            className="flex flex-col items-center space-y-6"
          >
            <div className="relative">
              <Wine className="h-24 w-24 text-sky-600" />
              <motion.div
                className="absolute -right-2 -top-2"
                initial={{ scale: 0 }}
                animate={{ scale: stage >= 1 ? 1 : 0 }}
                transition={{ delay: 0.3 }}
              >
                <span className="text-4xl">✨</span>
              </motion.div>
            </div>
            <motion.h1 
              className="text-6xl font-bold text-gray-900"
              initial={{ y: 20 }}
              animate={{ y: stage >= 1 ? 0 : 20 }}
            >
              BevPro
            </motion.h1>
          </motion.div>

          {/* Sign In Button Animation - similar to iCloud's */}
          <motion.button
            className="px-6 py-2 bg-black/90 backdrop-blur-sm text-white rounded-full text-sm font-medium shadow-lg border border-white/10 hover:bg-black/80 transition-all"
            initial={{ opacity: 0, y: 20 }}
            animate={{ 
              opacity: stage >= 2 ? 1 : 0,
              y: stage >= 2 ? 0 : 20
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onComplete}
          >
            Sign in
          </motion.button>

          {/* Tagline Animation */}
          <motion.p
            className="text-xl font-medium text-gray-800 max-w-lg mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ 
              opacity: stage >= 3 ? 1 : 0,
              y: stage >= 3 ? 0 : 20
            }}
            transition={{ delay: 0.2 }}
          >
            The best place for all your beverage orders, voice commands, and more.
          </motion.p>

          {/* Feature Icons Animation */}
          <motion.div 
            className="grid grid-cols-3 gap-8 mt-12 bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20"
            initial={{ opacity: 0, y: 20 }}
            animate={{ 
              opacity: stage >= 3 ? 1 : 0,
              y: stage >= 3 ? 0 : 20
            }}
            transition={{ delay: 0.4 }}
          >
            <div className="flex flex-col items-center space-y-2">
              <span className="text-4xl">🎙️</span>
              <p className="text-sm text-gray-600">Voice Control</p>
            </div>
            <div className="flex flex-col items-center space-y-2">
              <span className="text-4xl">🤖</span>
              <p className="text-sm text-gray-600">AI Assistant</p>
            </div>
            <div className="flex flex-col items-center space-y-2">
              <span className="text-4xl">🍹</span>
              <p className="text-sm text-gray-600">Smart Orders</p>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}