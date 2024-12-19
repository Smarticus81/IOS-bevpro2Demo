import { Home, Settings, Calendar, Package, BarChart3 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BevProLogo } from "./BevProLogo";

export function NavBar() {
  const [location] = useLocation();

  const navItems = [
    { href: "/", icon: Home, label: "Home" },
    { href: "/inventory", icon: Package, label: "Inventory" },
    { href: "/events", icon: Calendar, label: "Events" },
    { href: "/settings", icon: Settings, label: "Settings" },
    { href: "/dashboard", icon: BarChart3, label: "Dashboard" },
  ];

  return (
    <div className="sticky top-0 z-50 w-full border-b border-white/10 bg-black/50 backdrop-blur-xl">
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
                      "gap-2 text-white/70 hover:text-white hover:bg-white/10",
                      location === item.href && "bg-white/10 text-white"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                </Link>
              ))}
            </nav>
          </div>

          {/* Mobile Navigation */}
          <nav className="md:hidden flex items-center gap-1">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "text-white/70 hover:text-white hover:bg-white/10",
                    location === item.href && "bg-white/10 text-white"
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
  );
}
