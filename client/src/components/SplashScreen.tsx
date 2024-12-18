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
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[#1e2024]/90" />
          <img src="/image.png" alt="BevPro Background" className="w-full h-full object-contain" />
        </div>
        <div className="text-center space-y-12 max-w-2xl mx-auto px-4 relative z-10">
          {/* Sign In Button Animation */}
          <motion.button
            className="px-6 py-2 bg-gradient-to-b from-zinc-800 to-black text-white rounded-full text-sm font-medium shadow-[0_4px_10px_rgba(0,0,0,0.3)] border border-white/10 backdrop-blur-sm hover:shadow-[0_6px_20px_rgba(0,0,0,0.4)] hover:from-zinc-700 hover:to-zinc-900 transition-all duration-300"
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
            className="text-xl font-medium text-white max-w-lg mx-auto"
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
            className="grid grid-cols-3 gap-8 mt-12"
            initial={{ opacity: 0, y: 20 }}
            animate={{ 
              opacity: stage >= 3 ? 1 : 0,
              y: stage >= 3 ? 0 : 20
            }}
            transition={{ delay: 0.4 }}
          >
            <div className="flex flex-col items-center space-y-2">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center shadow-lg transform hover:scale-105 transition-transform">
                <span className="text-3xl">👩‍🍳</span>
              </div>
              <p className="text-sm text-white/90">Voice Orders</p>
            </div>
            <div className="flex flex-col items-center space-y-2">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center shadow-lg transform hover:scale-105 transition-transform">
                <span className="text-3xl">🧠</span>
              </div>
              <p className="text-sm text-white/90">AI Assistant</p>
            </div>
            <div className="flex flex-col items-center space-y-2">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg transform hover:scale-105 transition-transform">
                <span className="text-3xl">🥂</span>
              </div>
              <p className="text-sm text-white/90">Smart Menu</p>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}