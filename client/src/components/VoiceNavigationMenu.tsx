import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'wouter';
import { ChevronRight, Home, LayoutDashboard, Settings, ShoppingCart, CalendarDays } from 'lucide-react';
import type { NavigationCommand } from '@/types/speech';

interface Props {
  isVisible: boolean;
  activeCommand?: string;
  onNavigate: (path: string) => void;
}

const navigationCommands: NavigationCommand[] = [
  { command: 'go to home', path: '/', description: 'Main menu', icon: 'Home' },
  { command: 'go to dashboard', path: '/dashboard', description: 'View analytics', icon: 'LayoutDashboard' },
  { command: 'open cart', path: '/cart', description: 'View order', icon: 'ShoppingCart' },
  { command: 'go to events', path: '/events', description: 'Event packages', icon: 'CalendarDays' },
  { command: 'open settings', path: '/settings', description: 'App settings', icon: 'Settings' },
];

const getIcon = (iconName: string) => {
  const icons: Record<string, React.ElementType> = {
    Home,
    LayoutDashboard,
    ShoppingCart,
    CalendarDays,
    Settings,
  };
  return icons[iconName] || Home;
};

export function VoiceNavigationMenu({ isVisible, activeCommand, onNavigate }: Props) {
  const [location] = useLocation();

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-x-0 bottom-24 z-50 mx-auto w-full max-w-sm px-4"
        >
          <div className="rounded-xl bg-white/95 shadow-2xl ring-1 ring-black/5 backdrop-blur-lg">
            <div className="p-2">
              <h3 className="px-3 py-2 text-sm font-medium text-gray-900">
                Voice Navigation Shortcuts
              </h3>
              <div className="space-y-1">
                {navigationCommands.map((cmd) => {
                  const Icon = cmd.icon ? getIcon(cmd.icon) : ChevronRight;
                  const isActive = cmd.path === location;
                  const isHighlighted = activeCommand?.toLowerCase().includes(cmd.command);

                  return (
                    <motion.button
                      key={cmd.command}
                      onClick={() => onNavigate(cmd.path)}
                      className={`
                        relative w-full flex items-center gap-2 px-3 py-2 text-sm
                        rounded-lg transition-colors
                        ${isActive ? 'bg-primary/10 text-primary' : 'text-gray-700'}
                        ${isHighlighted ? 'bg-primary/5' : 'hover:bg-gray-100'}
                      `}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="flex-1 text-left">{cmd.description}</span>
                      <span className="text-xs text-gray-400">
                        Say "{cmd.command}"
                      </span>
                      {isHighlighted && (
                        <motion.div
                          layoutId="highlight"
                          className="absolute inset-0 rounded-lg bg-primary/10"
                          initial={false}
                          transition={{
                            type: "spring",
                            stiffness: 500,
                            damping: 30
                          }}
                        />
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
