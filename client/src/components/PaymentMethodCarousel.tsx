import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { 
  CreditCard, 
  Wallet, 
  Smartphone, 
  QrCode,
  Check
} from "lucide-react";

interface PaymentMethodCarouselProps {
  selectedMethod: string;
  onSelect: (method: string) => void;
}

interface PaymentMethod {
  id: string;
  icon: JSX.Element;
  label: string;
  color: string;
}

export function PaymentMethodCarousel({ selectedMethod, onSelect }: PaymentMethodCarouselProps) {
  const [methods] = useState<PaymentMethod[]>([
    {
      id: "credit_card",
      icon: <CreditCard className="h-6 w-6" />,
      label: "Credit Card",
      color: "bg-gradient-to-br from-blue-500 to-blue-600"
    },
    {
      id: "apple_pay",
      icon: <Wallet className="h-6 w-6" />,
      label: "Apple Pay",
      color: "bg-gradient-to-br from-zinc-800 to-black"
    },
    {
      id: "google_pay",
      icon: <Smartphone className="h-6 w-6" />,
      label: "Google Pay",
      color: "bg-gradient-to-br from-green-500 to-green-600"
    },
    {
      id: "qr_code",
      icon: <QrCode className="h-6 w-6" />,
      label: "QR Code",
      color: "bg-gradient-to-br from-purple-500 to-purple-600"
    }
  ]);

  return (
    <div className="w-full overflow-hidden py-4">
      <motion.div 
        className="flex space-x-4 px-4"
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <AnimatePresence mode="wait">
          {methods.map((method) => (
            <motion.button
              key={method.id}
              onClick={() => onSelect(method.id)}
              className={`relative flex flex-col items-center justify-center p-4 rounded-xl transition-shadow duration-200
                ${selectedMethod === method.id 
                  ? 'bg-white shadow-xl border border-white/20 backdrop-blur-sm' 
                  : 'bg-white/80 hover:bg-white hover:shadow-lg border border-white/10 backdrop-blur-sm'
                }`}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ 
                opacity: 1, 
                y: 0,
                scale: selectedMethod === method.id ? 1.05 : 1
              }}
              exit={{ opacity: 0, y: 20 }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 25
              }}
            >
              <motion.div 
                className={`p-3 rounded-full ${method.color} shadow-lg mb-2`}
                whileHover={{ rotate: [0, -10, 10, -10, 0] }}
                transition={{ duration: 0.5 }}
              >
                {method.icon}
              </motion.div>
              <span className="text-sm font-medium text-gray-700">
                {method.label}
              </span>
              <AnimatePresence>
                {selectedMethod === method.id && (
                  <motion.div
                    className="absolute -top-1 -right-1 bg-green-500 rounded-full p-1 shadow-lg"
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0, rotate: 180 }}
                    transition={{ 
                      type: "spring",
                      stiffness: 500,
                      damping: 30
                    }}
                  >
                    <Check className="h-3 w-3 text-white" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          ))}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
