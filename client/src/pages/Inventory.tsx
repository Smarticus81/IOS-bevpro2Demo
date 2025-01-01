import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { NavBar } from "@/components/NavBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Package, AlertTriangle, Search, Plus, History } from "lucide-react";
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

  const filteredInventory = pourInventory.filter(item => {
    const drink = drinks.find(d => d.id === item.drink_id);
    return drink?.name.toLowerCase().includes(search.toLowerCase()) ||
           drink?.category.toLowerCase().includes(search.toLowerCase());
  });

  const getLowStockBottles = () => 
    pourInventory.filter(item => 
      (item.remaining_volume_ml / item.initial_volume_ml) < 0.2 && item.is_active
    );

  const getTotalTaxOwed = () => {
    return pourTransactions.reduce((total, transaction) => {
      return total + (transaction.tax_amount || 0);
    }, 0);
  };

  return (
    <div className="min-h-screen bg-background">
      <NavBar />

      <div className="px-4 pt-20 pb-8 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Pour Inventory Management</h1>
            <p className="text-white/70">Track pour-level inventory and tax calculations</p>
          </div>

          <div className="grid gap-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="bg-white/90 backdrop-blur-md border-white/20 shadow-xl">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <Package className="h-6 w-6 text-primary" />
                    <div>
                      <p className="text-sm text-gray-600">Active Bottles</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {pourInventory.filter(i => i.is_active).length}
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
                        {getLowStockBottles().length}
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
                      <p className="text-sm text-gray-600">Pours Today</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {pourTransactions.filter(t => 
                          new Date(t.transaction_time).toDateString() === new Date().toDateString()
                        ).length}
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
                <CardTitle>Pour Inventory</CardTitle>
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
                    Add Bottle
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                <Tabs defaultValue="active" className="w-full">
                  <TabsList className="w-full justify-start rounded-none border-b p-0">
                    <TabsTrigger value="active" className="rounded-none border-b-2 data-[state=active]:border-primary">
                      Active Bottles
                    </TabsTrigger>
                    <TabsTrigger value="empty" className="rounded-none border-b-2 data-[state=active]:border-primary">
                      Empty/Archived
                    </TabsTrigger>
                    <TabsTrigger value="transactions" className="rounded-none border-b-2 data-[state=active]:border-primary">
                      Pour History
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="active" className="mt-0">
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
                          {filteredInventory.filter(item => item.is_active).map((item) => {
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
                                <div className="col-span-2 font-medium text-gray-900">
                                  {drink?.name}
                                  <div className="text-xs text-gray-500">{drink?.category}</div>
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

                  <TabsContent value="empty" className="mt-0">
                    {/* Similar structure for empty/archived bottles */}
                  </TabsContent>

                  <TabsContent value="transactions" className="mt-0">
                    <ScrollArea className="h-[60vh]">
                      <div className="w-full">
                        <div className="grid grid-cols-7 gap-4 p-4 text-sm font-medium text-gray-500 border-b">
                          <div className="col-span-2">Drink</div>
                          <div>Pour Size</div>
                          <div>Volume</div>
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
                                <div className="col-span-2 font-medium text-gray-900">
                                  {drink?.name}
                                  <div className="text-xs text-gray-500">{drink?.category}</div>
                                </div>
                                <div>{transaction.pour_size_id}</div>
                                <div>{transaction.volume_ml}ml</div>
                                <div>${transaction.tax_amount?.toFixed(2) || '0.00'}</div>
                                <div className="text-sm text-gray-500">
                                  {new Date(transaction.transaction_time).toLocaleTimeString()}
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