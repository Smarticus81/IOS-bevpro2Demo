import { Sidebar, SidebarContent, SidebarHeader, SidebarTrigger, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Home, Package, Brain, Settings } from "lucide-react";
import { Link, useLocation } from "wouter";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-background">
        {/* Mobile Header */}
        <div className="fixed top-0 left-0 right-0 h-14 border-b bg-background flex items-center px-4 md:hidden z-50">
          <SidebarTrigger />
          <span className="ml-4 font-semibold">Bar POS</span>
        </div>

        {/* Sidebar Navigation */}
        <Sidebar>
          <SidebarHeader className="flex items-center justify-between p-4">
            <span className="font-bold text-lg hidden md:block">Bar POS</span>
          </SidebarHeader>
          <SidebarContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location === "/"}
                  tooltip="Orders"
                >
                  <Link href="/">
                    <Home className="h-4 w-4" />
                    <span>Orders</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location === "/inventory"}
                  tooltip="Inventory"
                >
                  <Link href="/inventory">
                    <Package className="h-4 w-4" />
                    <span>Inventory</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location === "/ai-management"}
                  tooltip="AI Management"
                >
                  <Link href="/ai-management">
                    <Brain className="h-4 w-4" />
                    <span>AI Management</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location === "/settings"}
                  tooltip="Settings"
                >
                  <Link href="/settings">
                    <Settings className="h-4 w-4" />
                    <span>Settings</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarContent>
        </Sidebar>

        {/* Main Content */}
        <main className="flex-1 pt-14 md:pt-0">
          <div className="container mx-auto p-4 md:p-8">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
