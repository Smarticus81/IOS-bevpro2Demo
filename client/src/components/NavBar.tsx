import { Home, Package, Menu as MenuIcon } from "lucide-react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { motion } from "framer-motion";

interface NavBarProps {
  drinks?: any[];
}

export function NavBar({ drinks }: NavBarProps) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", icon: Home, label: "Home" },
    { href: "/inventory", icon: Package, label: "Inventory" },
  ];

  return (
    <motion.div 
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="sticky top-0 z-50 w-full border-b bg-white/90 dark:bg-black/90 backdrop-blur-xl shadow-lg"
    >
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">

          <motion.div 
            className="hidden md:flex items-center space-x-1 w-full justify-end"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <motion.button
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  className={`
                    px-4 py-2 rounded-xl flex items-center gap-2
                    transition-all duration-200 ease-out
                    ${location === item.href 
                      ? 'bg-primary/10 text-primary shadow-lg backdrop-blur-lg' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/80 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800/50'}
                    bg-clip-padding backdrop-filter backdrop-blur-xl
                    border border-gray-200/20 dark:border-gray-700/20
                  `}
                >
                  <item.icon className="h-4 w-4" />
                  <span className="font-medium">{item.label}</span>
                </motion.button>
              </Link>
            ))}
          </motion.div>

          <motion.div 
            className="flex items-center gap-2 md:hidden"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <motion.button
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  className="p-2 rounded-xl text-gray-600 hover:text-gray-900 
                           bg-white/50 dark:bg-gray-800/50 backdrop-blur-lg
                           border border-gray-200/20 dark:border-gray-700/20
                           shadow-lg dark:text-gray-400 dark:hover:text-white 
                           transition-all duration-200"
                >
                  <MenuIcon className="h-5 w-5" />
                </motion.button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                align="end" 
                className="w-56 bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl
                          border border-gray-200/50 dark:border-gray-700/50
                          shadow-xl rounded-xl"
              >
                <DropdownMenuGroup>
                  {navItems.map((item) => (
                    <Link key={item.href} href={item.href}>
                      <DropdownMenuItem className="flex items-center gap-2 focus:bg-gray-100/80
                                                dark:focus:bg-gray-800/50 cursor-pointer
                                                transition-all duration-200
                                                rounded-lg m-1">
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