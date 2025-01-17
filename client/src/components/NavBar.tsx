import { Home, Package, Database, Menu as MenuIcon } from "lucide-react";
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
    { href: "/database", icon: Database, label: "Database" },
  ];

  return (
    <motion.div 
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-xl shadow-sm"
    >
      <div className="container mx-auto px-6">
        <div className="flex h-16 items-center justify-between">
          <motion.div 
            className="hidden md:flex items-center space-x-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    "px-5 py-2.5 rounded-xl flex items-center gap-2.5 text-sm font-medium transition-all duration-200",
                    location === item.href 
                      ? "bg-gray-900 text-white shadow-sm" 
                      : "text-gray-600 hover:bg-gray-100"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  <span className="font-medium">{item.label}</span>
                </motion.button>
              </Link>
            ))}
          </motion.div>

          <motion.div 
            className="flex md:hidden"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="h-10 w-10 rounded-xl p-0 hover:bg-gray-100"
                >
                  <MenuIcon className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                align="end" 
                className="w-56 bg-white/95 backdrop-blur-xl rounded-xl border-gray-200 shadow-lg"
              >
                <DropdownMenuGroup>
                  {navItems.map((item) => (
                    <Link key={item.href} href={item.href}>
                      <DropdownMenuItem className={cn(
                        "flex items-center gap-2.5 rounded-lg px-3 py-2.5 cursor-pointer transition-colors duration-200",
                        location === item.href 
                          ? "bg-gray-900 text-white" 
                          : "text-gray-600 hover:bg-gray-100"
                      )}>
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