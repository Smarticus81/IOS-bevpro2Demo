import { Home, Settings, Calendar, Package, BarChart3, Sun, Moon } from "lucide-react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BevProLogo } from "./BevProLogo";
import { VoiceControl } from "./VoiceControl";
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
    <div className="sticky top-0 z-50 w-full border-b bg-white dark:bg-black/90 shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-6">
            <BevProLogo />
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant="ghost"
                    className={cn(
                      "gap-2 text-gray-600 hover:text-black dark:text-gray-400 dark:hover:text-white",
                      location === item.href && "bg-gray-100 text-black dark:bg-gray-800 dark:text-white"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                </Link>
              ))}
            </nav>
          </div>

          {/* Voice Control, Theme Toggle & Mobile Navigation */}
          <div className="flex items-center gap-2">
            {drinks.length > 0 && onAddToCart && (
              <VoiceControl
                drinks={drinks}
                onAddToCart={onAddToCart}
                variant="compact"
              />
            )}
            
            <Button
              variant="ghost"
              size="icon"
              className="text-gray-600 hover:text-black dark:text-gray-400 dark:hover:text-white"
              onClick={() => document.documentElement.classList.toggle('dark')}
            >
              <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>
            
            <nav className="md:hidden flex items-center gap-1">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "text-gray-600 hover:text-black dark:text-gray-400 dark:hover:text-white",
                      location === item.href && "bg-gray-100 text-black dark:bg-gray-800 dark:text-white"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                  </Button>
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
}
