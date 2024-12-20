import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, AlertTriangle, CheckCircle } from "lucide-react";
import { useState, useEffect } from "react";

interface Alert {
  id: string;
  type: 'warning' | 'error' | 'success';
  message: string;
  timestamp: Date;
}

interface InventoryAlertProps {
  alerts?: Alert[];
  onDismiss?: (id: string) => void;
}

export function InventoryAlert({ alerts = [], onDismiss }: InventoryAlertProps) {
  const [visibleAlerts, setVisibleAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    setVisibleAlerts(alerts.slice(0, 3));
  }, [alerts]);

  const getIcon = (type: Alert['type']) => {
    switch (type) {
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'success':
        return <CheckCircle className="h-5 w-5 text-emerald-500" />;
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      <AnimatePresence>
        {visibleAlerts.map((alert) => (
          <motion.div
            key={alert.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex items-center gap-2 p-4 bg-white/90 backdrop-blur-sm 
                     border border-gray-200/20 rounded-lg shadow-lg
                     min-w-[300px] max-w-md"
          >
            {getIcon(alert.type)}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {alert.message}
              </p>
              <p className="text-xs text-gray-500">
                {alert.timestamp.toLocaleTimeString()}
              </p>
            </div>
            {onDismiss && (
              <button
                onClick={() => onDismiss(alert.id)}
                className="text-gray-400 hover:text-gray-500"
              >
                ×
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
