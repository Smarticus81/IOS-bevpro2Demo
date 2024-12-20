import { Home, Settings, Calendar, Package, BarChart3, Sun, Moon, Menu } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BevProLogo } from "./BevProLogo";
import { VoiceControl } from "./VoiceControl";
import { motion } from "framer-motion";
import type { Drink } from "@db/schema";
import type { CartAction } from "./VoiceControl";

interface NavBarProps {
  drinks?: Drink[];
  onAddToCart?: (params: CartAction) => void;
}

export function NavBar({ drinks = [], onAddToCart }: NavBarProps) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", icon: Home, label: "Home" },
    { href: "/inventory", icon: Package, label: "Inventory" },
    { href: "/events", icon: Calendar, label: "Events" },
    { href: "/settings", icon: Settings, label: "Settings" },
    { href: "/dashboard", icon: BarChart3, label: "Dashboard" },
  ];

  return (
    <motion.div 
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="sticky top-0 z-50 w-full border-b bg-white/80 dark:bg-black/90 backdrop-blur-lg shadow-sm"
    >
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Voice Control */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <VoiceControl
              drinks={drinks || []}
              onAddToCart={onAddToCart || (() => {})}
              variant="compact"
            />
          </motion.div>

          {/* Navigation Items - Desktop */}
          <motion.div 
            className="hidden md:flex items-center space-x-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`
                    px-4 py-2 rounded-lg flex items-center gap-2
                    transition-all duration-200 ease-out
                    ${location === item.href 
                      ? 'bg-primary/10 text-primary' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/80 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800/50'}
                  `}
                >
                  <item.icon className="h-4 w-4" />
                  <span className="font-medium">{item.label}</span>
                </motion.button>
              </Link>
            ))}
          </motion.div>

          {/* Controls */}
          <motion.div 
            className="flex items-center gap-2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="text-gray-600 hover:text-black dark:text-gray-400 dark:hover:text-white
                       p-2 rounded-lg transition-colors duration-200"
              onClick={() => document.documentElement.classList.toggle('dark')}
            >
              <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </motion.button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="md:hidden p-2 rounded-lg text-gray-600 hover:text-gray-900 
                           hover:bg-gray-100/80 dark:text-gray-400 dark:hover:text-white 
                           dark:hover:bg-gray-800/50 transition-colors duration-200"
                >
                  <Menu className="h-5 w-5" />
                </motion.button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                align="end" 
                className="w-56 bg-white/90 dark:bg-gray-900/90 backdrop-blur-lg
                         border border-gray-200/50 dark:border-gray-700/50"
              >
                <DropdownMenuGroup>
                  {navItems.map((item) => (
                    <Link key={item.href} href={item.href}>
                      <DropdownMenuItem className="flex items-center gap-2 focus:bg-gray-100/80
                                               dark:focus:bg-gray-800/50 cursor-pointer">
                        <item.icon className="h-4 w-4" />
                        <span className="font-medium">{item.label}</span>
                      </DropdownMenuItem>
                    </Link>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
