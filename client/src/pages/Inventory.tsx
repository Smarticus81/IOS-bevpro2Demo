import { useState, useEffect } from "react";
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
import { InventoryAnalytics } from "@/components/InventoryAnalytics";
import { Skeleton } from "@/components/ui/skeleton";
import { useWebSocket } from "@/hooks/useWebSocket";
import { AddInventoryItem } from "@/components/AddInventoryItem";

interface ApiResponse<T> {
  data: T[];
  pagination: {
    currentPage: number;
    limit: number;
    totalItems: number;
  };
}

export function Inventory() {
  useWebSocket();
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  const { data: drinks, isLoading: isDrinksLoading } = useQuery<{ drinks: Drink[] }>({
    queryKey: ["/api/drinks"]
  });

  const { 
    data: pourInventoryResponse, 
    isLoading: isPourInventoryLoading 
  } = useQuery<ApiResponse<PourInventory & { 
    drink_name: string;
    drink_category: string;
    tax_category_name: string;
  }>>({
    queryKey: ["/api/pour-inventory"]
  });

  const { data: taxCategoriesResponse } = useQuery<ApiResponse<TaxCategory>>({
    queryKey: ["/api/tax-categories"]
  });

  const { 
    data: pourTransactionsResponse, 
    isLoading: isTransactionsLoading 
  } = useQuery<ApiResponse<PourTransaction & {
    drink_name: string;
    drink_category: string;
  }>>({
    queryKey: ["/api/pour-transactions"]
  });

  useEffect(() => {
    const isRefetching = isDrinksLoading || isPourInventoryLoading || isTransactionsLoading;

    if (isRefetching) {
      toast({
        title: "Syncing Inventory",
        description: "Updating inventory data in real-time...",
        duration: 2000,
      });
    }
  }, [isDrinksLoading, isPourInventoryLoading, isTransactionsLoading, toast]);

  const allDrinks = drinks?.drinks || [];
  const pourInventory = pourInventoryResponse?.data || [];
  const taxCategories = taxCategoriesResponse?.data || [];
  const pourTransactions = pourTransactionsResponse?.data || [];

  const getBeverageIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'beer': return <Beer className="h-4 w-4 text-amber-500" />;
      case 'wine': return <Wine className="h-4 w-4 text-purple-500" />;
      case 'non-alcoholic': return <Coffee className="h-4 w-4 text-blue-500" />;
      default: return <Package className="h-4 w-4 text-blue-500" />;
    }
  };

  const needsPourTracking = (category: string) => {
    return ['spirits', 'classics', 'signature'].includes(category.toLowerCase());
  };

  const filteredInventory = {
    pourTracked: pourInventory.filter(item => 
      item.drink_name?.toLowerCase().includes(search.toLowerCase()) ||
      item.drink_category?.toLowerCase().includes(search.toLowerCase())
    ),
    packageTracked: allDrinks.filter(drink => 
      !needsPourTracking(drink.category) &&
      (drink.name.toLowerCase().includes(search.toLowerCase()) ||
       drink.category.toLowerCase().includes(search.toLowerCase()))
    )
  };

  const getLowStockBottles = () => 
    pourInventory.filter(item => {
      const remainingRatio = item.remaining_volume_ml && item.initial_volume_ml
        ? Number(item.remaining_volume_ml) / Number(item.initial_volume_ml)
        : 1;
      return remainingRatio < 0.2 && item.is_active;
    });

  const getLowStockPackages = () =>
    allDrinks.filter(drink => 
      !needsPourTracking(drink.category) && 
      typeof drink.inventory === 'number' && 
      drink.inventory < 10
    );

  const getTotalTaxOwed = () => {
    return pourTransactions.reduce((total, transaction) => {
      const taxAmount = transaction.tax_amount 
        ? Number(transaction.tax_amount) 
        : 0;
      return total + taxAmount;
    }, 0);
  };

  const LoadingRow = () => (
    <div className="grid grid-cols-8 gap-4 p-4 items-center">
      {Array(8).fill(0).map((_, i) => (
        <Skeleton key={i} className={`h-8 ${i === 0 ? 'col-span-2' : ''}`} />
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-white">
      <NavBar />

      <div className="container mx-auto px-4 py-6">
        <InventoryAnalytics 
          drinks={allDrinks}
          inventoryHistory={pourTransactions}
        />

        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Beverage Inventory</h1>
          <p className="text-gray-500 mt-1">Track all beverage inventory with specialized pour and package tracking</p>
        </div>

        <div className="grid gap-4">
          <div className="grid grid-cols-4 gap-4">
            <Card className="bg-white border border-gray-100">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Package className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="text-sm text-gray-600">Active Inventory</p>
                    <p className="text-xl font-semibold text-gray-900">
                      {pourInventory.filter(i => i.is_active).length + 
                       allDrinks.filter(d => !needsPourTracking(d.category)).length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border border-gray-100">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  <div>
                    <p className="text-sm text-gray-600">Low Stock</p>
                    <p className="text-xl font-semibold text-gray-900">
                      {getLowStockBottles().length + getLowStockPackages().length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border border-gray-100">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <History className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="text-sm text-gray-600">Today's Activity</p>
                    <p className="text-xl font-semibold text-gray-900">
                      {pourTransactions.filter(t => {
                        const date = t.transaction_time ? new Date(t.transaction_time) : null;
                        return date && date.toDateString() === new Date().toDateString();
                      }).length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border border-gray-100">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="text-sm text-gray-600">Tax Owed</p>
                    <p className="text-xl font-semibold text-gray-900">
                      ${getTotalTaxOwed().toFixed(2)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-white border border-gray-100">
            <CardHeader className="px-4 py-3 flex flex-row items-center justify-between border-b border-gray-100">
              <CardTitle className="text-lg font-semibold">Inventory Management</CardTitle>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-gray-50 rounded-md px-3 py-1.5">
                  <Search className="h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search inventory..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 p-0 h-auto placeholder:text-gray-400"
                  />
                </div>
                <AddInventoryItem
                  trigger={
                    <Button size="sm" className="h-8 gap-1.5 bg-blue-500 hover:bg-blue-600">
                      <Plus className="h-4 w-4" />
                      Add Item
                    </Button>
                  }
                />
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <Tabs defaultValue="pour" className="w-full">
                <TabsList className="w-full justify-start rounded-none border-b p-0 h-auto">
                  <TabsTrigger 
                    value="pour" 
                    className="rounded-none border-b-2 data-[state=active]:border-blue-500 data-[state=active]:text-blue-500 px-4 py-2"
                  >
                    Pour Tracked
                  </TabsTrigger>
                  <TabsTrigger 
                    value="package" 
                    className="rounded-none border-b-2 data-[state=active]:border-blue-500 data-[state=active]:text-blue-500 px-4 py-2"
                  >
                    Package Tracked
                  </TabsTrigger>
                  <TabsTrigger 
                    value="transactions" 
                    className="rounded-none border-b-2 data-[state=active]:border-blue-500 data-[state=active]:text-blue-500 px-4 py-2"
                  >
                    Transactions
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="pour" className="mt-0">
                  <ScrollArea className="h-[calc(100vh-24rem)] scrollbar-hide">
                    <div className="w-full">
                      <div className="grid grid-cols-8 gap-4 p-3 text-sm font-medium text-gray-500 border-b border-gray-100">
                        <div className="col-span-2">Drink</div>
                        <div>Bottle ID</div>
                        <div>Tax Category</div>
                        <div>Initial Vol.</div>
                        <div>Remaining</div>
                        <div>Last Pour</div>
                        <div>Status</div>
                      </div>

                      <div className="divide-y divide-gray-50">
                        {isPourInventoryLoading ? (
                          Array(5).fill(0).map((_, i) => (
                            <div key={i} className="grid grid-cols-8 gap-4 p-3 items-center">
                              {Array(8).fill(0).map((_, j) => (
                                <Skeleton key={j} className={`h-8 ${j === 0 ? 'col-span-2' : ''}`} />
                              ))}
                            </div>
                          ))
                        ) : (
                          filteredInventory.pourTracked.map((item) => {
                            const remainingPercentage = item.remaining_volume_ml && item.initial_volume_ml
                              ? (Number(item.remaining_volume_ml) / Number(item.initial_volume_ml)) * 100
                              : 0;

                            return (
                              <motion.div
                                key={item.id}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="grid grid-cols-8 gap-4 p-3 items-center hover:bg-gray-50/50"
                              >
                                <div className="col-span-2 font-medium text-gray-900 flex items-center gap-2">
                                  {getBeverageIcon(item.drink_category || '')}
                                  <div>
                                    {item.drink_name}
                                    <div className="text-xs text-gray-500">{item.drink_category}</div>
                                  </div>
                                </div>
                                <div className="font-mono text-sm text-gray-600">{item.bottle_id}</div>
                                <div className="text-gray-600">{item.tax_category_name || 'N/A'}</div>
                                <div className="text-gray-600">{item.initial_volume_ml}ml</div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <div className="w-16 bg-gray-100 rounded-full h-1.5">
                                      <div
                                        className="bg-blue-500 rounded-full h-1.5"
                                        style={{ width: `${remainingPercentage}%` }}
                                      />
                                    </div>
                                    <span className="text-sm text-gray-600">{Math.round(remainingPercentage)}%</span>
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
                                    className={remainingPercentage < 20 
                                      ? "bg-red-50 text-red-600 border border-red-200" 
                                      : "bg-green-50 text-green-600 border border-green-200"}
                                  >
                                    {remainingPercentage < 20 ? "Low" : "OK"}
                                  </Badge>
                                </div>
                              </motion.div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="package" className="mt-0">
                  <ScrollArea className="h-[calc(100vh-24rem)] scrollbar-hide">
                    <div className="w-full">
                      <div className="grid grid-cols-6 gap-4 p-3 text-sm font-medium text-gray-500 border-b border-gray-100">
                        <div className="col-span-2">Item</div>
                        <div>Category</div>
                        <div>Price</div>
                        <div>In Stock</div>
                        <div>Status</div>
                      </div>

                      <div className="divide-y divide-gray-50">
                        {isDrinksLoading ? (
                          Array(5).fill(0).map((_, i) => (
                            <div key={i} className="grid grid-cols-6 gap-4 p-3 items-center">
                              {Array(6).fill(0).map((_, j) => (
                                <Skeleton key={j} className={`h-8 ${j === 0 ? 'col-span-2' : ''}`} />
                              ))}
                            </div>
                          ))
                        ) : (
                          filteredInventory.packageTracked.map((drink) => (
                            <motion.div
                              key={drink.id}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="grid grid-cols-6 gap-4 p-3 items-center hover:bg-gray-50/50"
                            >
                              <div className="col-span-2 font-medium text-gray-900 flex items-center gap-2">
                                {getBeverageIcon(drink.category)}
                                <div>
                                  {drink.name}
                                  <div className="text-xs text-gray-500">{drink.subcategory}</div>
                                </div>
                              </div>
                              <div className="text-gray-600">{drink.category}</div>
                              <div className="text-gray-600">${drink.price}</div>
                              <div className="text-gray-600">{drink.inventory} units</div>
                              <div>
                                <Badge
                                  variant={drink.inventory < 10 ? "destructive" : "default"}
                                  className={drink.inventory < 10 
                                    ? "bg-red-50 text-red-600 border border-red-200" 
                                    : "bg-green-50 text-green-600 border border-green-200"}
                                >
                                  {drink.inventory < 10 ? "Low" : "OK"}
                                </Badge>
                              </div>
                            </motion.div>
                          ))
                        )}
                      </div>
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="transactions" className="mt-0">
                  <ScrollArea className="h-[calc(100vh-24rem)] scrollbar-hide">
                    <div className="w-full">
                      <div className="grid grid-cols-7 gap-4 p-3 text-sm font-medium text-gray-500 border-b border-gray-100">
                        <div className="col-span-2">Item</div>
                        <div>Type</div>
                        <div>Quantity</div>
                        <div>Tax Amount</div>
                        <div>Time</div>
                        <div>Staff</div>
                      </div>

                      <div className="divide-y divide-gray-50">
                        {isTransactionsLoading ? (
                          Array(5).fill(0).map((_, i) => (
                            <div key={i} className="grid grid-cols-7 gap-4 p-3 items-center">
                              {Array(7).fill(0).map((_, j) => (
                                <Skeleton key={j} className={`h-8 ${j === 0 ? 'col-span-2' : ''}`} />
                              ))}
                            </div>
                          ))
                        ) : (
                          pourTransactions.map((transaction) => (
                            <motion.div
                              key={transaction.id}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="grid grid-cols-7 gap-4 p-3 items-center hover:bg-gray-50/50"
                            >
                              <div className="col-span-2 font-medium text-gray-900 flex items-center gap-2">
                                {getBeverageIcon(transaction.drink_category || '')}
                                <div>
                                  {transaction.drink_name}
                                  <div className="text-xs text-gray-500">{transaction.drink_category}</div>
                                </div>
                              </div>
                              <div className="text-gray-600">{transaction.pour_size_id ? 'Pour' : 'Package'}</div>
                              <div className="text-gray-600">
                                {transaction.volume_ml 
                                  ? `${transaction.volume_ml}ml`
                                  : '1 unit'
                                }
                              </div>
                              <div className="text-gray-600">${Number(transaction.tax_amount || 0).toFixed(2)}</div>
                              <div className="text-sm text-gray-500">
                                {transaction.transaction_time
                                  ? new Date(transaction.transaction_time).toLocaleTimeString()
                                  : 'N/A'
                                }
                              </div>
                              <div className="text-sm text-gray-600">Staff #{transaction.staff_id}</div>
                            </motion.div>
                          ))
                        )}
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
  );
}