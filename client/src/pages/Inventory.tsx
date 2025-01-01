import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { NavBar } from "@/components/NavBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Package, AlertTriangle, Search, Plus, History, Beer, Wine, Coffee } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Drink, PourInventory, TaxCategory, PourTransaction } from "@db/schema";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

export function Inventory() {
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  const { data: drinks = [] } = useQuery<Drink[]>({
    queryKey: ["/api/drinks"]
  });

  const { data: pourInventory = [] } = useQuery<PourInventory[]>({
    queryKey: ["/api/pour-inventory"]
  });

  const { data: taxCategories = [] } = useQuery<TaxCategory[]>({
    queryKey: ["/api/tax-categories"]
  });

  const { data: pourTransactions = [] } = useQuery<PourTransaction[]>({
    queryKey: ["/api/pour-transactions"]
  });

  const getBeverageIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'beer': return <Beer className="h-4 w-4 text-amber-500" />;
      case 'wine': return <Wine className="h-4 w-4 text-purple-500" />;
      case 'non-alcoholic': return <Coffee className="h-4 w-4 text-blue-500" />;
      default: return <Package className="h-4 w-4 text-primary" />;
    }
  };

  const needsPourTracking = (category: string) => {
    return ['spirits', 'classics', 'signature'].includes(category.toLowerCase());
  };

  const filteredInventory = {
    pourTracked: pourInventory.filter(item => {
      const drink = drinks.find(d => d.id === item.drink_id);
      return drink && needsPourTracking(drink.category) &&
             (drink.name.toLowerCase().includes(search.toLowerCase()) ||
              drink.category.toLowerCase().includes(search.toLowerCase()));
    }),
    packageTracked: drinks.filter(drink => 
      !needsPourTracking(drink.category) &&
      (drink.name.toLowerCase().includes(search.toLowerCase()) ||
       drink.category.toLowerCase().includes(search.toLowerCase()))
    )
  };

  const getLowStockBottles = () => 
    pourInventory.filter(item => 
      (item.remaining_volume_ml / item.initial_volume_ml) < 0.2 && item.is_active
    );

  const getLowStockPackages = () =>
    drinks.filter(drink => 
      !needsPourTracking(drink.category) && drink.inventory < 10
    );

  const getTotalTaxOwed = () => {
    return pourTransactions.reduce((total, transaction) => {
      if (typeof transaction.tax_amount === 'number') {
        return total + transaction.tax_amount;
      }
      return total;
    }, 0);
  };

  return (
    <div className="min-h-screen bg-background">
      <NavBar />

      <div className="px-4 pt-20 pb-8 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Beverage Inventory Management</h1>
            <p className="text-white/70">Track all beverage inventory with specialized pour and package tracking</p>
          </div>

          <div className="grid gap-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="bg-white/90 backdrop-blur-md border-white/20 shadow-xl">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <Package className="h-6 w-6 text-primary" />
                    <div>
                      <p className="text-sm text-gray-600">Active Inventory</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {pourInventory.filter(i => i.is_active).length + 
                         drinks.filter(d => !needsPourTracking(d.category)).length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/90 backdrop-blur-md border-white/20 shadow-xl">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <AlertTriangle className="h-6 w-6 text-yellow-500" />
                    <div>
                      <p className="text-sm text-gray-600">Low Stock</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {getLowStockBottles().length + getLowStockPackages().length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/90 backdrop-blur-md border-white/20 shadow-xl">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <History className="h-6 w-6 text-emerald-500" />
                    <div>
                      <p className="text-sm text-gray-600">Today's Activity</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {pourTransactions.filter(t => {
                          const date = t.transaction_time ? new Date(t.transaction_time) : null;
                          return date && date.toDateString() === new Date().toDateString();
                        }).length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/90 backdrop-blur-md border-white/20 shadow-xl">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <AlertTriangle className="h-6 w-6 text-blue-500" />
                    <div>
                      <p className="text-sm text-gray-600">Tax Owed</p>
                      <p className="text-2xl font-bold text-gray-900">
                        ${getTotalTaxOwed().toFixed(2)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Main Content */}
            <Card className="bg-white/90 backdrop-blur-md border-white/20 shadow-xl">
              <CardHeader className="p-4 flex flex-row items-center justify-between">
                <CardTitle>Inventory Management</CardTitle>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-gray-500" />
                    <Input
                      placeholder="Search inventory..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-[200px]"
                    />
                  </div>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Item
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                <Tabs defaultValue="pour" className="w-full">
                  <TabsList className="w-full justify-start rounded-none border-b p-0">
                    <TabsTrigger value="pour" className="rounded-none border-b-2 data-[state=active]:border-primary">
                      Pour Tracked Items
                    </TabsTrigger>
                    <TabsTrigger value="package" className="rounded-none border-b-2 data-[state=active]:border-primary">
                      Package Tracked Items
                    </TabsTrigger>
                    <TabsTrigger value="transactions" className="rounded-none border-b-2 data-[state=active]:border-primary">
                      Transaction History
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="pour" className="mt-0">
                    <ScrollArea className="h-[60vh]">
                      <div className="w-full">
                        <div className="grid grid-cols-8 gap-4 p-4 text-sm font-medium text-gray-500 border-b">
                          <div className="col-span-2">Drink</div>
                          <div>Bottle ID</div>
                          <div>Tax Category</div>
                          <div>Initial Vol.</div>
                          <div>Remaining</div>
                          <div>Last Pour</div>
                          <div>Status</div>
                        </div>

                        <div className="divide-y">
                          {filteredInventory.pourTracked.map((item) => {
                            const drink = drinks.find(d => d.id === item.drink_id);
                            const taxCategory = taxCategories.find(t => t.id === item.tax_category_id);
                            const remainingPercentage = (item.remaining_volume_ml / item.initial_volume_ml) * 100;

                            return (
                              <motion.div
                                key={item.id}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="grid grid-cols-8 gap-4 p-4 items-center hover:bg-gray-50/50"
                              >
                                <div className="col-span-2 font-medium text-gray-900 flex items-center gap-2">
                                  {getBeverageIcon(drink?.category || '')}
                                  <div>
                                    {drink?.name}
                                    <div className="text-xs text-gray-500">{drink?.category}</div>
                                  </div>
                                </div>
                                <div className="font-mono text-sm">{item.bottle_id}</div>
                                <div>{taxCategory?.name || 'N/A'}</div>
                                <div>{item.initial_volume_ml}ml</div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <div className="w-16 bg-gray-200 rounded-full h-2">
                                      <div
                                        className="bg-primary rounded-full h-2"
                                        style={{ width: `${remainingPercentage}%` }}
                                      />
                                    </div>
                                    <span className="text-sm">{Math.round(remainingPercentage)}%</span>
                                  </div>
                                </div>
                                <div className="text-sm text-gray-500">
                                  {item.last_pour_at 
                                    ? new Date(item.last_pour_at).toLocaleDateString()
                                    : 'Never'
                                  }
                                </div>
                                <div>
                                  <Badge
                                    variant={remainingPercentage < 20 ? "destructive" : "default"}
                                    className="bg-gradient-to-b from-zinc-800 to-black text-white shadow-sm"
                                  >
                                    {remainingPercentage < 20 ? "Low" : "OK"}
                                  </Badge>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="package" className="mt-0">
                    <ScrollArea className="h-[60vh]">
                      <div className="w-full">
                        <div className="grid grid-cols-6 gap-4 p-4 text-sm font-medium text-gray-500 border-b">
                          <div className="col-span-2">Item</div>
                          <div>Category</div>
                          <div>Price</div>
                          <div>In Stock</div>
                          <div>Status</div>
                        </div>

                        <div className="divide-y">
                          {filteredInventory.packageTracked.map((drink) => (
                            <motion.div
                              key={drink.id}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="grid grid-cols-6 gap-4 p-4 items-center hover:bg-gray-50/50"
                            >
                              <div className="col-span-2 font-medium text-gray-900 flex items-center gap-2">
                                {getBeverageIcon(drink.category)}
                                <div>
                                  {drink.name}
                                  <div className="text-xs text-gray-500">{drink.subcategory}</div>
                                </div>
                              </div>
                              <div>{drink.category}</div>
                              <div>${drink.price}</div>
                              <div>{drink.inventory} units</div>
                              <div>
                                <Badge
                                  variant={drink.inventory < 10 ? "destructive" : "default"}
                                  className="bg-gradient-to-b from-zinc-800 to-black text-white shadow-sm"
                                >
                                  {drink.inventory < 10 ? "Low" : "OK"}
                                </Badge>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="transactions" className="mt-0">
                    <ScrollArea className="h-[60vh]">
                      <div className="w-full">
                        <div className="grid grid-cols-7 gap-4 p-4 text-sm font-medium text-gray-500 border-b">
                          <div className="col-span-2">Item</div>
                          <div>Type</div>
                          <div>Quantity</div>
                          <div>Tax Amount</div>
                          <div>Time</div>
                          <div>Staff</div>
                        </div>

                        <div className="divide-y">
                          {pourTransactions.map((transaction) => {
                            const inventory = pourInventory.find(i => i.id === transaction.pour_inventory_id);
                            const drink = drinks.find(d => d.id === inventory?.drink_id);

                            return (
                              <motion.div
                                key={transaction.id}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="grid grid-cols-7 gap-4 p-4 items-center hover:bg-gray-50/50"
                              >
                                <div className="col-span-2 font-medium text-gray-900 flex items-center gap-2">
                                  {getBeverageIcon(drink?.category || '')}
                                  <div>
                                    {drink?.name}
                                    <div className="text-xs text-gray-500">{drink?.category}</div>
                                  </div>
                                </div>
                                <div>{transaction.pour_size_id ? 'Pour' : 'Package'}</div>
                                <div>
                                  {transaction.volume_ml 
                                    ? `${transaction.volume_ml}ml`
                                    : '1 unit'
                                  }
                                </div>
                                <div>${transaction.tax_amount?.toFixed(2) || '0.00'}</div>
                                <div className="text-sm text-gray-500">
                                  {transaction.transaction_time
                                    ? new Date(transaction.transaction_time).toLocaleTimeString()
                                    : 'N/A'
                                  }
                                </div>
                                <div className="text-sm">Staff #{transaction.staff_id}</div>
                              </motion.div>
                            );
                          })}
                        </div>
                      </div>
                    </ScrollArea>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}