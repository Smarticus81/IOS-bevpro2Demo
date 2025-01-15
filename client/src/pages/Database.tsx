import { useQuery } from "@tanstack/react-query";
import { NavBar } from "@/components/NavBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DatabaseIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

// Define types for API responses
interface DrinkResponse {
  drinks: Array<{
    id: number;
    name: string;
    category: string;
    subcategory: string | null;
    price: number;
    inventory: number;
    sales: number;
  }>;
}

interface PourInventoryResponse {
  data: Array<{
    id: number;
    drink_name: string;
    drink_category: string;
    bottle_id: string;
    initial_volume_ml: number;
    remaining_volume_ml: number;
    is_active: boolean;
    last_pour_at: string;
  }>;
}

interface PourTransactionResponse {
  data: Array<{
    id: number;
    drink_name: string;
    drink_category: string;
    volume_ml: number;
    staff_id: number;
    tax_amount: number;
    transaction_time: string;
    pour_size_id: number;
  }>;
}

interface TaxCategoryResponse {
  data: Array<{
    id: number;
    name: string;
    rate: number;
    description: string | null;
  }>;
}

export function DatabaseView() {
  const { data: drinksData, isLoading: isDrinksLoading } = useQuery<DrinkResponse>({
    queryKey: ["/api/drinks"],
  });

  const { data: pourInventoryData, isLoading: isPourInventoryLoading } = useQuery<PourInventoryResponse>({
    queryKey: ["/api/pour-inventory"],
  });

  const { data: pourTransactionsData, isLoading: isPourTransactionsLoading } = useQuery<PourTransactionResponse>({
    queryKey: ["/api/pour-transactions"],
  });

  const { data: taxCategoriesData, isLoading: isTaxCategoriesLoading } = useQuery<TaxCategoryResponse>({
    queryKey: ["/api/tax-categories"],
  });

  return (
    <div className="min-h-screen bg-white">
      <NavBar />
      <div className="container mx-auto px-4 py-6">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Database Overview</h1>
          <p className="text-gray-500 mt-1">View and monitor all database tables and their contents</p>
        </div>

        <div className="grid gap-4">
          <Card className="bg-white border border-gray-100">
            <CardHeader className="px-4 py-3 flex flex-row items-center justify-between border-b border-gray-100">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <DatabaseIcon className="h-5 w-5" />
                Database Tables
              </CardTitle>
            </CardHeader>

            <CardContent className="p-0">
              <Tabs defaultValue="drinks" className="w-full">
                <TabsList className="w-full justify-start rounded-none border-b p-0 h-auto">
                  <TabsTrigger
                    value="drinks"
                    className="rounded-none border-b-2 data-[state=active]:border-blue-500 data-[state=active]:text-blue-500 px-4 py-2"
                  >
                    Drinks Table
                  </TabsTrigger>
                  <TabsTrigger
                    value="pour_inventory"
                    className="rounded-none border-b-2 data-[state=active]:border-blue-500 data-[state=active]:text-blue-500 px-4 py-2"
                  >
                    Pour Inventory
                  </TabsTrigger>
                  <TabsTrigger
                    value="pour_transactions"
                    className="rounded-none border-b-2 data-[state=active]:border-blue-500 data-[state=active]:text-blue-500 px-4 py-2"
                  >
                    Pour Transactions
                  </TabsTrigger>
                  <TabsTrigger
                    value="tax_categories"
                    className="rounded-none border-b-2 data-[state=active]:border-blue-500 data-[state=active]:text-blue-500 px-4 py-2"
                  >
                    Tax Categories
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="drinks" className="mt-0">
                  <ScrollArea className="h-[calc(100vh-24rem)] scrollbar-hide">
                    <div className="w-full">
                      <div className="grid grid-cols-8 gap-4 p-3 text-sm font-medium text-gray-500 border-b border-gray-100">
                        <div className="col-span-2">Name</div>
                        <div>Category</div>
                        <div>Subcategory</div>
                        <div>Price</div>
                        <div>Inventory</div>
                        <div>Sales</div>
                        <div>ID</div>
                      </div>
                      <div className="divide-y divide-gray-50">
                        {isDrinksLoading ? (
                          Array(5).fill(0).map((_, i) => (
                            <div key={i} className="grid grid-cols-8 gap-4 p-3 items-center">
                              {Array(8).fill(0).map((_, j) => (
                                <Skeleton key={j} className={`h-8 ${j === 0 ? 'col-span-2' : ''}`} />
                              ))}
                            </div>
                          ))
                        ) : drinksData?.drinks ? (
                          drinksData.drinks.map((drink) => (
                            <div key={drink.id} className="grid grid-cols-8 gap-4 p-3 items-center hover:bg-gray-50/50">
                              <div className="col-span-2 font-medium text-gray-900">{drink.name}</div>
                              <div className="text-gray-600">{drink.category}</div>
                              <div className="text-gray-600">{drink.subcategory || '-'}</div>
                              <div className="text-gray-600">${drink.price}</div>
                              <div className="text-gray-600">{drink.inventory}</div>
                              <div className="text-gray-600">{drink.sales}</div>
                              <div className="font-mono text-sm text-gray-500">{drink.id}</div>
                            </div>
                          ))
                        ) : (
                          <div className="p-4 text-center text-gray-500">No drinks data available</div>
                        )}
                      </div>
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="pour_inventory" className="mt-0">
                  <ScrollArea className="h-[calc(100vh-24rem)] scrollbar-hide">
                    <div className="w-full">
                      <div className="grid grid-cols-8 gap-4 p-3 text-sm font-medium text-gray-500 border-b border-gray-100">
                        <div className="col-span-2">Drink</div>
                        <div>Bottle ID</div>
                        <div>Initial Vol.</div>
                        <div>Remaining Vol.</div>
                        <div>Status</div>
                        <div>Last Pour</div>
                        <div>ID</div>
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
                        ) : pourInventoryData?.data ? (
                          pourInventoryData.data.map((item) => (
                            <div key={item.id} className="grid grid-cols-8 gap-4 p-3 items-center hover:bg-gray-50/50">
                              <div className="col-span-2 font-medium text-gray-900">
                                {item.drink_name}
                                <div className="text-xs text-gray-500">{item.drink_category}</div>
                              </div>
                              <div className="font-mono text-sm text-gray-600">{item.bottle_id}</div>
                              <div className="text-gray-600">{item.initial_volume_ml}ml</div>
                              <div className="text-gray-600">{item.remaining_volume_ml}ml</div>
                              <div>
                                <Badge
                                  variant={item.is_active ? "default" : "secondary"}
                                  className={item.is_active
                                    ? "bg-green-50 text-green-600 border border-green-200"
                                    : "bg-gray-50 text-gray-600 border border-gray-200"}
                                >
                                  {item.is_active ? "Active" : "Inactive"}
                                </Badge>
                              </div>
                              <div className="text-sm text-gray-500">
                                {item.last_pour_at
                                  ? new Date(item.last_pour_at).toLocaleDateString()
                                  : 'Never'
                                }
                              </div>
                              <div className="font-mono text-sm text-gray-500">{item.id}</div>
                            </div>
                          ))
                        ) : (
                          <div className="p-4 text-center text-gray-500">No pour inventory data available</div>
                        )}
                      </div>
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="pour_transactions" className="mt-0">
                  <ScrollArea className="h-[calc(100vh-24rem)] scrollbar-hide">
                    <div className="w-full">
                      <div className="grid grid-cols-8 gap-4 p-3 text-sm font-medium text-gray-500 border-b border-gray-100">
                        <div className="col-span-2">Drink</div>
                        <div>Volume</div>
                        <div>Staff ID</div>
                        <div>Tax Amount</div>
                        <div>Time</div>
                        <div>Pour Size</div>
                        <div>ID</div>
                      </div>
                      <div className="divide-y divide-gray-50">
                        {isPourTransactionsLoading ? (
                          Array(5).fill(0).map((_, i) => (
                            <div key={i} className="grid grid-cols-8 gap-4 p-3 items-center">
                              {Array(8).fill(0).map((_, j) => (
                                <Skeleton key={j} className={`h-8 ${j === 0 ? 'col-span-2' : ''}`} />
                              ))}
                            </div>
                          ))
                        ) : pourTransactionsData?.data ? (
                          pourTransactionsData.data.map((transaction) => (
                            <div key={transaction.id} className="grid grid-cols-8 gap-4 p-3 items-center hover:bg-gray-50/50">
                              <div className="col-span-2 font-medium text-gray-900">
                                {transaction.drink_name}
                                <div className="text-xs text-gray-500">{transaction.drink_category}</div>
                              </div>
                              <div className="text-gray-600">{transaction.volume_ml}ml</div>
                              <div className="text-gray-600">#{transaction.staff_id}</div>
                              <div className="text-gray-600">${Number(transaction.tax_amount || 0).toFixed(2)}</div>
                              <div className="text-sm text-gray-500">
                                {transaction.transaction_time
                                  ? new Date(transaction.transaction_time).toLocaleTimeString()
                                  : 'N/A'
                                }
                              </div>
                              <div className="text-gray-600">Size #{transaction.pour_size_id}</div>
                              <div className="font-mono text-sm text-gray-500">{transaction.id}</div>
                            </div>
                          ))
                        ) : (
                          <div className="p-4 text-center text-gray-500">No pour transactions data available</div>
                        )}
                      </div>
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="tax_categories" className="mt-0">
                  <ScrollArea className="h-[calc(100vh-24rem)] scrollbar-hide">
                    <div className="w-full">
                      <div className="grid grid-cols-4 gap-4 p-3 text-sm font-medium text-gray-500 border-b border-gray-100">
                        <div>Name</div>
                        <div>Rate</div>
                        <div>Description</div>
                        <div>ID</div>
                      </div>
                      <div className="divide-y divide-gray-50">
                        {isTaxCategoriesLoading ? (
                          Array(5).fill(0).map((_, i) => (
                            <div key={i} className="grid grid-cols-4 gap-4 p-3 items-center">
                              {Array(4).fill(0).map((_, j) => (
                                <Skeleton key={j} className="h-8" />
                              ))}
                            </div>
                          ))
                        ) : taxCategoriesData?.data ? (
                          taxCategoriesData.data.map((category) => (
                            <div key={category.id} className="grid grid-cols-4 gap-4 p-3 items-center hover:bg-gray-50/50">
                              <div className="font-medium text-gray-900">{category.name}</div>
                              <div className="text-gray-600">{category.rate}%</div>
                              <div className="text-gray-600">{category.description || '-'}</div>
                              <div className="font-mono text-sm text-gray-500">{category.id}</div>
                            </div>
                          ))
                        ) : (
                          <div className="p-4 text-center text-gray-500">No tax categories data available</div>
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