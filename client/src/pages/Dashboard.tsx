import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NavBar } from "@/components/NavBar";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Area, AreaChart } from 'recharts';
import { DollarSign, TrendingUp, Users, Package, Loader2, Calendar, BarChart3, Clock, AlertCircle, ShoppingCart, ArrowUpRight, ArrowDownRight, Percent, AlertOctagon } from "lucide-react";
import type { Drink, Order, OrderItem } from "@db/schema";
import { motion } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface RevenueMetric {
  period: string;
  amount: number;
  growth: number;
}

interface ProductPerformance {
  id: number;
  name: string;
  category: string;
  revenue: number;
  quantity: number;
  profitMargin: number;
}

interface InventoryAlert {
  id: number;
  name: string;
  currentStock: number;
  minRequired: number;
  expiryDate?: string;
  supplierName?: string;
}

interface DashboardStats {
  // Revenue Metrics
  dailyRevenue: RevenueMetric;
  weeklyRevenue: RevenueMetric;
  monthlyRevenue: RevenueMetric;
  yearlyRevenue: RevenueMetric;

  // Sales Performance
  topProducts: ProductPerformance[];
  categoryPerformance: Array<{
    category: string;
    revenue: number;
    growth: number;
    profitMargin: number;
  }>;

  // Real-time Metrics
  liveSales: Array<{
    timestamp: string;
    amount: number;
    category: string;
  }>;
  averageOrderValue: number;
  orderTrends: Array<{
    hour: number;
    orders: number;
    value: number;
  }>;

  // Inventory Metrics
  totalInventoryValue: number;
  lowStockItems: InventoryAlert[];
  expiringItems: InventoryAlert[];
  stockDistribution: Array<{
    category: string;
    inStock: number;
    value: number;
  }>;

  // System Metrics
  systemUptime: number;
  orderFulfillmentTime: number;
  activeOrders: number;
}

// Premium gradients for charts
const GRADIENTS = {
  primary: {
    start: '#60A5FA',
    end: '#3B82F6'
  },
  secondary: {
    start: '#10B981',
    end: '#059669'
  },
  accent: {
    start: '#F472B6',
    end: '#EC4899'
  },
  warning: {
    start: '#FBBF24',
    end: '#D97706'
  }
};

export function Dashboard() {
  const [selectedTimeframe, setSelectedTimeframe] = useState<'day' | 'week' | 'month' | 'year'>('day');

  const { data: stats, isLoading, error } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="p-6">
            <p className="text-red-500">Error loading dashboard data</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Get current revenue metric based on selected timeframe
  const getCurrentRevenue = () => {
    switch (selectedTimeframe) {
      case 'day':
        return stats.dailyRevenue;
      case 'week':
        return stats.weeklyRevenue;
      case 'month':
        return stats.monthlyRevenue;
      case 'year':
        return stats.yearlyRevenue;
    }
  };

  const currentRevenue = getCurrentRevenue();

  return (
    <div className="min-h-screen bg-background">
      <NavBar />

      <div className="container mx-auto p-4 lg:p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard</h1>
          <p className="text-muted-foreground">Real-time insights and analytics</p>
        </div>

        {/* Revenue Overview Section */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Revenue & Performance</h2>
          <Tabs defaultValue="day" className="mb-4">
            <TabsList>
              <TabsTrigger value="day" onClick={() => setSelectedTimeframe('day')}>Daily</TabsTrigger>
              <TabsTrigger value="week" onClick={() => setSelectedTimeframe('week')}>Weekly</TabsTrigger>
              <TabsTrigger value="month" onClick={() => setSelectedTimeframe('month')}>Monthly</TabsTrigger>
              <TabsTrigger value="year" onClick={() => setSelectedTimeframe('year')}>Yearly</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="grid gap-4 md:grid-cols-4">
            {/* Revenue Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 
                            backdrop-blur-md border-white/20 shadow-xl hover:shadow-2xl transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-blue-500/10 rounded-full">
                        <DollarSign className="h-8 w-8 text-blue-500" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{selectedTimeframe.charAt(0).toUpperCase() + selectedTimeframe.slice(1)} Revenue</p>
                        <p className="text-2xl font-bold">
                          ${(currentRevenue.amount / 100).toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          })}
                        </p>
                      </div>
                    </div>
                    {currentRevenue.growth > 0 ? (
                      <div className="flex items-center text-emerald-500">
                        <ArrowUpRight className="h-4 w-4" />
                        <span className="text-sm font-medium">+{currentRevenue.growth}%</span>
                      </div>
                    ) : (
                      <div className="flex items-center text-red-500">
                        <ArrowDownRight className="h-4 w-4" />
                        <span className="text-sm font-medium">{currentRevenue.growth}%</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Average Order Value */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 
                            backdrop-blur-md border-white/20 shadow-xl hover:shadow-2xl transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-green-500/10 rounded-full">
                        <ShoppingCart className="h-8 w-8 text-green-500" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Avg. Order Value</p>
                        <p className="text-2xl font-bold">
                          ${(stats.averageOrderValue / 100).toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Profit Margin */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 
                            backdrop-blur-md border-white/20 shadow-xl hover:shadow-2xl transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-purple-500/10 rounded-full">
                        <Percent className="h-8 w-8 text-purple-500" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Avg. Profit Margin</p>
                        <p className="text-2xl font-bold">
                          {stats.categoryPerformance.reduce((acc, cat) => acc + cat.profitMargin, 0) / 
                           stats.categoryPerformance.length}%
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Inventory Alerts */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 
                            backdrop-blur-md border-white/20 shadow-xl hover:shadow-2xl transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-amber-500/10 rounded-full">
                        <AlertOctagon className="h-8 w-8 text-amber-500" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Stock Alerts</p>
                        <p className="text-2xl font-bold">{stats.lowStockItems.length}</p>
                      </div>
                    </div>
                    {stats.expiringItems.length > 0 && (
                      <div className="flex items-center text-amber-500">
                        <AlertCircle className="h-4 w-4" />
                        <span className="text-sm font-medium ml-1">{stats.expiringItems.length} expiring</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>

        {/* Revenue Chart & Category Performance */}
        <div className="grid gap-6 md:grid-cols-2 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <Card className="bg-white/95 backdrop-blur-md border-white/20 shadow-xl">
              <CardHeader className="border-b border-gray-100/10">
                <CardTitle className="flex items-center gap-2 text-lg font-medium">
                  <TrendingUp className="h-5 w-5 text-blue-500" />
                  Revenue Trend
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats.liveSales} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={GRADIENTS.primary.start} stopOpacity={0.2}/>
                          <stop offset="95%" stopColor={GRADIENTS.primary.end} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200/30" />
                      <XAxis
                        dataKey="timestamp"
                        tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
                        tickLine={false}
                        axisLine={{ stroke: 'hsl(var(--border))' }}
                      />
                      <YAxis
                        tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
                        tickLine={false}
                        axisLine={{ stroke: 'hsl(var(--border))' }}
                        tickFormatter={(value) => `$${(value / 100).toFixed(0)}`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--background))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '0.75rem',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
                        }}
                        formatter={(value: number) => [`$${(value / 100).toFixed(2)}`, 'Revenue']}
                      />
                      <Area
                        type="monotone"
                        dataKey="amount"
                        stroke={GRADIENTS.primary.start}
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorRevenue)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <Card className="bg-white/95 backdrop-blur-md border-white/20 shadow-xl">
              <CardHeader className="border-b border-gray-100/10">
                <CardTitle className="flex items-center gap-2 text-lg font-medium">
                  <BarChart3 className="h-5 w-5 text-emerald-500" />
                  Category Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.categoryPerformance} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={GRADIENTS.secondary.start} stopOpacity={0.8}/>
                          <stop offset="95%" stopColor={GRADIENTS.secondary.end} stopOpacity={1}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200/30" />
                      <XAxis
                        dataKey="category"
                        tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
                        tickLine={false}
                        axisLine={{ stroke: 'hsl(var(--border))' }}
                      />
                      <YAxis
                        tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
                        tickLine={false}
                        axisLine={{ stroke: 'hsl(var(--border))' }}
                        tickFormatter={(value) => `$${(value / 100).toFixed(0)}`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--background))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '0.75rem',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
                        }}
                        formatter={(value: number, name: string) => {
                          if (name === 'revenue') return [`$${(value / 100).toFixed(2)}`, 'Revenue'];
                          if (name === 'profitMargin') return [`${value}%`, 'Profit Margin'];
                          return [value, name];
                        }}
                      />
                      <Bar
                        dataKey="revenue"
                        fill="url(#barGradient)"
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Top Products & Inventory Alerts */}
        <div className="grid gap-6 md:grid-cols-2 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
          >
            <Card className="bg-white/95 backdrop-blur-md border-white/20 shadow-xl">
              <CardHeader className="border-b border-gray-100/10">
                <CardTitle className="flex items-center gap-2 text-lg font-medium">
                  <TrendingUp className="h-5 w-5 text-amber-500" />
                  Top Selling Products
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {stats.topProducts.map((product, index) => (
                    <motion.div
                      key={product.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                      className="flex items-center justify-between p-4 rounded-lg bg-gray-50/50"
                    >
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {product.category} • {product.quantity} units
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">
                          ${(product.revenue / 100).toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          })}
                        </p>
                        <p className="text-sm text-emerald-500">
                          {product.profitMargin}% margin
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.7 }}
          >
            <Card className="bg-white/95 backdrop-blur-md border-white/20 shadow-xl">
              <CardHeader className="border-b border-gray-100/10">
                <CardTitle className="flex items-center gap-2 text-lg font-medium">
                  <AlertOctagon className="h-5 w-5 text-amber-500" />
                  Inventory Alerts
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {stats.lowStockItems.map((item, index) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                      className="p-4 rounded-lg bg-gray-50/50"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Current stock: {item.currentStock}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-amber-500">
                            Min required: {item.minRequired}
                          </p>
                          {item.expiryDate && (
                            <p className="text-sm text-red-500">
                              Expires: {new Date(item.expiryDate).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                      {item.supplierName && (
                        <div className="text-sm text-muted-foreground">
                          Recommended supplier: {item.supplierName}
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}