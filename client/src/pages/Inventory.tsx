import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { NavBar } from "@/components/NavBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Package, AlertTriangle, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Drink } from "@db/schema";
import { useToast } from "@/hooks/use-toast";
import { InventoryAnalytics } from "@/components/InventoryAnalytics";

export function Inventory() {
  const [search, setSearch] = useState("");
  const [inventoryChanges, setInventoryChanges] = useState<Record<number, number>>({});
  const [alerts, setAlerts] = useState<Array<{
    id: string;
    type: 'warning' | 'error' | 'success';
    message: string;
    timestamp: Date;
  }>>([]);
  const { toast } = useToast();
  
  const { data: drinks = [] } = useQuery<Drink[]>({
    queryKey: ["/api/drinks"],
    onSuccess: (data) => {
      // Check for low stock items
      const lowStockItems = data.filter(drink => drink.inventory < 10);
      if (lowStockItems.length > 0) {
        setAlerts(prev => [
          ...prev,
          {
            id: Date.now().toString(),
            type: 'warning',
            message: `${lowStockItems.length} items are running low on stock`,
            timestamp: new Date()
          }
        ]);
      }
    }
  });

  const updateInventoryMutation = useMutation({
    mutationFn: async (updates: { id: number; inventory: number }[]) => {
      const response = await fetch("/api/inventory/bulk-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates })
      });
      if (!response.ok) throw new Error("Failed to update inventory");
      return response.json();
    }
  });

  const filteredDrinks = drinks.filter(drink =>
    drink.name.toLowerCase().includes(search.toLowerCase()) ||
    drink.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <InventoryAlert 
        alerts={alerts}
        onDismiss={(id) => setAlerts(prev => prev.filter(alert => alert.id !== id))}
      />
      
      <div className="container mx-auto p-4 lg:p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Inventory Management</h1>
          <p className="text-white/70">Monitor and manage your beverage inventory</p>
        </div>

        <div className="grid gap-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-white/90 backdrop-blur-md border-white/20 shadow-xl">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <Package className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-sm text-gray-600">Total Items</p>
                    <p className="text-2xl font-bold text-gray-900">{drinks.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/90 backdrop-blur-md border-white/20 shadow-xl">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <AlertTriangle className="h-8 w-8 text-yellow-500" />
                  <div>
                    <p className="text-sm text-gray-600">Low Stock Items</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {drinks.filter(d => d.inventory < 10).length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/90 backdrop-blur-md border-white/20 shadow-xl">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <Package className="h-8 w-8 text-emerald-500" />
                  <div>
                    <p className="text-sm text-gray-600">Categories</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {new Set(drinks.map(d => d.category)).size}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Analytics Dashboard */}
          <InventoryAnalytics drinks={drinks} />

          {/* Inventory List */}
          <Card className="bg-white/90 backdrop-blur-md border-white/20 shadow-xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Inventory List</CardTitle>
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-gray-500" />
                  <Input
                    placeholder="Search inventory..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-[200px]"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border">
                <div className="grid grid-cols-5 gap-4 p-4 font-medium text-sm text-gray-600 border-b">
                  <div>Item</div>
                  <div>Category</div>
                  <div className="text-center">Price</div>
                  <div className="text-center">Stock</div>
                  <div className="text-center">Status</div>
                </div>
                <div className="divide-y">
                  {filteredDrinks.map((drink) => (
                    <div key={drink.id} className="grid grid-cols-5 gap-4 p-4 items-center">
                      <div className="font-medium text-gray-900">{drink.name}</div>
                      <div className="text-gray-600">{drink.category}</div>
                      <div className="text-center text-gray-900">${drink.price}</div>
                      <div className="text-center">
                        <Input
                          type="number"
                          value={inventoryChanges[drink.id] ?? drink.inventory}
                          onChange={(e) => {
                            const value = parseInt(e.target.value) || 0;
                            setInventoryChanges(prev => ({
                              ...prev,
                              [drink.id]: value
                            }));
                          }}
                          className="w-20 mx-auto text-center"
                          min={0}
                        />
                      </div>
                      <div className="text-center">
                        <Badge 
                          variant={drink.inventory > 10 ? "default" : "destructive"}
                          className="bg-gradient-to-b from-zinc-800 to-black text-white shadow-sm"
                        >
                          {drink.inventory > 10 ? "In Stock" : "Low Stock"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-4">
                <Button
                  onClick={() => {
                    const updates = Object.entries(inventoryChanges).map(([id, inventory]) => ({
                      id: parseInt(id),
                      inventory
                    }));
                    if (updates.length > 0) {
                      updateInventoryMutation.mutate(updates, {
                        onSuccess: () => {
                          toast({
                            title: "Inventory Updated",
                            description: "Changes have been saved successfully"
                          });
                          setInventoryChanges({});
                        }
                      });
                    }
                  }}
                  disabled={Object.keys(inventoryChanges).length === 0 || updateInventoryMutation.isPending}
                  className="w-full bg-gradient-to-b from-zinc-800 to-black text-white shadow-sm"
                >
                  {updateInventoryMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
