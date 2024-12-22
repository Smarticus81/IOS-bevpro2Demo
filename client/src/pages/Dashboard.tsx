import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NavBar } from "@/components/NavBar";
import { useQuery, useMutation } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { DollarSign, TrendingUp, Users, Package, ShoppingCart } from "lucide-react";
import { motion } from "framer-motion";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type { Drink } from "@db/schema";

type CartAction = 
  | { type: 'ADD_ITEM'; drink: Drink; quantity: number }
  | { type: 'COMPLETE_TRANSACTION' };


interface SalesData {
  totalSales: number;
  todaySales: number;
  activeOrders: number;
  totalCustomers: number;
}

interface CategoryData {
  name: string;
  value: number;
}

interface TrendData {
  name: string;
  sales: number;
}

export function Dashboard() {
  const [activeCategory, setActiveCategory] = useState<string | undefined>();
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month' | 'year'>('week');
  const [chartType, setChartType] = useState<'bar' | 'line' | 'pie'>('bar');
  
  const { data: drinks = [] } = useQuery<Drink[]>({
    queryKey: ["/api/drinks"],
  });

  const filteredDrinks = activeCategory
    ? drinks.filter(drink => drink.category === activeCategory)
    : drinks;

  // In a real app, this would come from the API
  const salesData: SalesData = {
    totalSales: 15420,
    todaySales: 1240,
    activeOrders: 8,
    totalCustomers: 142
  };

  // Calculate category distribution
  const categoryData: CategoryData[] = Object.entries(
    drinks.reduce((acc, drink) => {
      acc[drink.category] = (acc[drink.category] || 0) + (drink.sales || 0);
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value }));

  // Generate mock trend data
  const trendData: TrendData[] = [
    { name: 'Mon', sales: 1200 },
    { name: 'Tue', sales: 1800 },
    { name: 'Wed', sales: 1600 },
    { name: 'Thu', sales: 2200 },
    { name: 'Fri', sales: 2400 },
    { name: 'Sat', sales: 2800 },
    { name: 'Sun', sales: 2000 },
  ];

  // Chart colors
  const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD'];

  const popularDrinks = drinks
    .sort((a, b) => (b.sales || 0) - (a.sales || 0))
    .slice(0, 5)
    .map(drink => ({
      name: drink.name,
      sales: drink.sales || 0
    }));

  const [cart, setCart] = useState<Array<{ drink: Drink; quantity: number }>>([]);
  const [isOrderDrawerOpen, setIsOrderDrawerOpen] = useState(false);
  const { toast } = useToast();

  const addToCart = (action: CartAction) => {
    if (action.type === 'ADD_ITEM') {
      const { drink, quantity } = action;
      setCart(prev => {
        const existing = prev.find(item => item.drink.id === drink.id);
        if (existing) {
          return prev.map(item => 
            item.drink.id === drink.id 
              ? { ...item, quantity: item.quantity + quantity }
              : item
          );
        }
        return [...prev, { drink, quantity }];
      });
    } else if (action.type === 'COMPLETE_TRANSACTION') {
      placeOrder();
    }
  };

  const removeFromCart = (drinkId: number) => {
    setCart(prev => prev.filter(item => item.drink.id !== drinkId));
  };

  const orderMutation = useMutation({
    mutationFn: async (orderData: any) => {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderData)
      });
      if (!response.ok) throw new Error("Failed to create order");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Order placed successfully",
        description: "Your order has been placed successfully"
      });
      setCart([]);
      setIsOrderDrawerOpen(false);
    },
    onError: () => {
      toast({
        title: "Failed to place order",
        variant: "destructive"
      });
    }
  });

  const placeOrder = async () => {
    if (cart.length === 0) return;

    const total = cart.reduce((sum, item) => {
      return sum + (Number(item.drink.price) * item.quantity);
    }, 0);

    const items = cart.map(item => ({
      id: item.drink.id,
      quantity: item.quantity,
      price: Number(item.drink.price)
    }));

    await orderMutation.mutateAsync({ items, total });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black">
      <NavBar drinks={drinks} onAddToCart={addToCart} />
      
      <div className="container mx-auto p-4 lg:p-8">
        
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard</h1>
          <p className="text-muted-foreground">Welcome to your beverage management dashboard</p>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 backdrop-blur-md border-white/20 shadow-xl">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-blue-500/10 rounded-full">
                  <DollarSign className="h-8 w-8 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Sales</p>
                  <p className="text-2xl font-bold">${salesData.totalSales.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 backdrop-blur-md border-white/20 shadow-xl">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-green-500/10 rounded-full">
                  <TrendingUp className="h-8 w-8 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Today's Sales</p>
                  <p className="text-2xl font-bold">${salesData.todaySales.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 backdrop-blur-md border-white/20 shadow-xl">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-purple-500/10 rounded-full">
                  <Package className="h-8 w-8 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active Orders</p>
                  <p className="text-2xl font-bold">{salesData.activeOrders}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 backdrop-blur-md border-white/20 shadow-xl">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-orange-500/10 rounded-full">
                  <Users className="h-8 w-8 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Customers</p>
                  <p className="text-2xl font-bold">{salesData.totalCustomers}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Popular Drinks Chart */}
        <Card className="bg-white/90 backdrop-blur-md border-white/20 shadow-xl mb-8">
          <CardHeader>
            <CardTitle>Popular Drinks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={popularDrinks}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <CartesianGrid 
                    strokeDasharray="3 3" 
                    className="stroke-muted/50" 
                    vertical={false}
                  />
                  <XAxis 
                    dataKey="name"
                    className="text-xs font-medium"
                    tick={{ fill: 'currentColor' }}
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                    height={60}
                    angle={-45}
                    textAnchor="end"
                  />
                  <YAxis 
                    className="text-xs font-medium"
                    tick={{ fill: 'currentColor' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${value}`}
                  />
                  <Tooltip
                    cursor={{ fill: 'hsl(var(--muted))' }}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      borderColor: 'hsl(var(--border))',
                      borderRadius: 'var(--radius)',
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                      color: 'hsl(var(--foreground))'
                    }}
                    itemStyle={{
                      color: 'hsl(var(--foreground))'
                    }}
                    formatter={(value) => [`${value} sales`, 'Sales']}
                    labelStyle={{
                      color: 'hsl(var(--muted-foreground))',
                      fontWeight: 500,
                      marginBottom: '0.5rem'
                    }}
                  />
                  <Bar 
                    dataKey="sales"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={50}
                    animationDuration={1000}
                    animationBegin={0}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Additional Charts Row */}
        <div className="grid gap-4 md:grid-cols-2 mt-8">
          {/* Category Distribution */}
          <Card className="bg-white/90 backdrop-blur-md border-white/20 shadow-xl">
            <CardHeader>
              <CardTitle>Category Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                      animationDuration={1000}
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        borderColor: 'hsl(var(--border))',
                        borderRadius: 'var(--radius)',
                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                      }}
                      formatter={(value: number) => [`${value} sales`, 'Sales']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Sales Trend */}
          <Card className="bg-white/90 backdrop-blur-md border-white/20 shadow-xl">
            <CardHeader>
              <CardTitle>Weekly Sales Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" vertical={false} />
                    <XAxis 
                      dataKey="name"
                      className="text-xs font-medium"
                      tick={{ fill: 'currentColor' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      className="text-xs font-medium"
                      tick={{ fill: 'currentColor' }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `$${value}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        borderColor: 'hsl(var(--border))',
                        borderRadius: 'var(--radius)',
                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                      }}
                      formatter={(value: number) => [`$${value}`, 'Sales']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="sales" 
                      stroke="#FF6B6B"
                      strokeWidth={2}
                      dot={{ fill: '#FF6B6B', strokeWidth: 2 }}
                      activeDot={{ r: 8 }}
                      animationDuration={1000}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Mobile Order Summary Drawer */}
      <Drawer
        open={isOrderDrawerOpen}
        onOpenChange={setIsOrderDrawerOpen}
        snapPoints={[0.9, 0.5, 0.1]}
        activeSnapPoint={0.5}
        className="fixed bottom-0 left-0 right-0 z-50"
      >
        <DrawerContent className="bg-white/95 backdrop-blur-lg border-t border-white/20 rounded-t-xl shadow-2xl">
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Order Summary
            </DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-8">
            <div className="space-y-4 max-h-[50vh] overflow-y-auto">
              {cart.map((item) => (
                <Card key={item.drink.id} className="bg-white/50 border-white/20">
                  <CardContent className="p-4 flex justify-between items-center">
                    <div>
                      <p className="font-medium">{item.drink.name}</p>
                      <p className="text-sm text-gray-600">${item.drink.price} × {item.quantity}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFromCart(item.drink.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      Remove
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
            {cart.length > 0 && (
              <div className="mt-4">
                <Button
                  className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white"
                  onClick={() => placeOrder()}
                  disabled={orderMutation.isPending}
                >
                  {orderMutation.isPending ? "Processing..." : "Place Order"}
                </Button>
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Mobile Order Summary Toggle Button */}
      <motion.button
        className="fixed bottom-4 right-4 lg:hidden z-40 p-4 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOrderDrawerOpen(true)}
      >
        <ShoppingCart className="w-6 h-6" />
        {cart.length > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
            {cart.length}
          </span>
        )}
      </motion.button>
    </div>
  );
}
