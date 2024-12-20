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
        className="fixed inset-0 flex flex-col items-center justify-center overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, transition: { duration: 0.3 } }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-gray-50 via-gray-100 to-white backdrop-blur-3xl" 
             style={{
               backgroundImage: "linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.1) 100%)",
               boxShadow: "inset 0 0 100px rgba(255,255,255,0.2)"
             }}
        />
        
        <div className="text-center space-y-12 max-w-2xl mx-auto px-4 relative z-10">
          {/* BP Logo */}
          <motion.div
            className="mb-8"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", duration: 1.5, bounce: 0.4 }}
          >
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-gray-900 to-gray-800 shadow-2xl">
              <span className="text-3xl font-bold bg-gradient-to-r from-gray-100 to-white bg-clip-text text-transparent">
                BP
              </span>
            </div>
          </motion.div>

          {/* Sign In Button Animation */}
          <motion.button
            className="px-8 py-3 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white rounded-full text-sm font-medium shadow-[0_4px_20px_rgba(0,0,0,0.2)] border border-white/10 backdrop-blur-sm hover:shadow-[0_8px_30px_rgba(0,0,0,0.3)] transition-all duration-300"
            initial={{ opacity: 0, y: 20 }}
            animate={{ 
              opacity: stage >= 2 ? 1 : 0,
              y: stage >= 2 ? 0 : 20
            }}
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={onComplete}
          >
            Get Started
          </motion.button>

          {/* Main Tagline Animation */}
          <motion.h1
            className="text-4xl font-bold text-gray-900 max-w-lg mx-auto leading-tight"
            initial={{ opacity: 0, y: 20 }}
            animate={{ 
              opacity: stage >= 3 ? 1 : 0,
              y: stage >= 3 ? 0 : 20
            }}
            transition={{ delay: 0.2 }}
          >
            Your POS is no longer a P.O.S.
          </motion.h1>

          {/* Feature Icons Animation */}
          <motion.div 
            className="grid grid-cols-3 gap-8 mt-16"
            initial={{ opacity: 0, y: 20 }}
            animate={{ 
              opacity: stage >= 3 ? 1 : 0,
              y: stage >= 3 ? 0 : 20
            }}
            transition={{ delay: 0.4 }}
          >
            <motion.div 
              className="flex flex-col items-center space-y-3"
              whileHover={{ scale: 1.05 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center shadow-xl transform transition-transform border border-white/10">
                <span className="text-3xl">👩‍🍳</span>
              </div>
              <p className="text-sm font-medium text-gray-800">Voice Orders</p>
            </motion.div>
            <motion.div 
              className="flex flex-col items-center space-y-3"
              whileHover={{ scale: 1.05 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center shadow-xl transform transition-transform border border-white/10">
                <span className="text-3xl">🧠</span>
              </div>
              <p className="text-sm font-medium text-gray-800">AI Assistant</p>
            </motion.div>
            <motion.div 
              className="flex flex-col items-center space-y-3"
              whileHover={{ scale: 1.05 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center shadow-xl transform transition-transform border border-white/10">
                <span className="text-3xl">🥂</span>
              </div>
              <p className="text-sm font-medium text-gray-800">Smart Menu</p>
            </motion.div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
