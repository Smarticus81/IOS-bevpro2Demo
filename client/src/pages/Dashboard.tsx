import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NavBar } from "@/components/NavBar";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Area, AreaChart } from 'recharts';
import { DollarSign, TrendingUp, Users, Package, Loader2, Calendar, BarChart3, Clock, AlertCircle, ShoppingCart, ArrowUpRight, ArrowDownRight, Percent, AlertOctagon, Calendar as CalendarIcon, Box, Truck } from "lucide-react";
import type { Drink, Order, OrderItem } from "@db/schema";
import { motion } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// Add new interfaces for enhanced features
interface SupplierMetrics {
  name: string;
  onTimeDelivery: number;
  qualityScore: number;
  pendingOrders: number;
  totalSpend: number;
}

interface EventMetrics {
  name: string;
  date: string;
  revenue: number;
  guestCount: number;
  packageType: string;
}

interface PredictiveInsight {
  type: 'trend' | 'alert' | 'recommendation';
  message: string;
  impact: 'positive' | 'negative' | 'neutral';
  confidence: number;
}

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

// Default values for revenue metrics
const DEFAULT_REVENUE_METRIC: RevenueMetric = {
  period: '',
  amount: 0,
  growth: 0
};

// Add proper default for category performance
const DEFAULT_CATEGORY_PERFORMANCE = {
  category: '',
  revenue: 0,
  growth: 0,
  profitMargin: 0
};

const DEFAULT_DASHBOARD_STATS: DashboardStats = {
  dailyRevenue: DEFAULT_REVENUE_METRIC,
  weeklyRevenue: DEFAULT_REVENUE_METRIC,
  monthlyRevenue: DEFAULT_REVENUE_METRIC,
  yearlyRevenue: DEFAULT_REVENUE_METRIC,
  topProducts: [],
  categoryPerformance: [DEFAULT_CATEGORY_PERFORMANCE],
  liveSales: [],
  averageOrderValue: 0,
  orderTrends: [],
  totalInventoryValue: 0,
  lowStockItems: [],
  expiringItems: [],
  stockDistribution: [],
  systemUptime: 0,
  orderFulfillmentTime: 0,
  activeOrders: 0
};

export function Dashboard() {
  const [selectedTimeframe, setSelectedTimeframe] = useState<'day' | 'week' | 'month' | 'year'>('day');
  const [activeSection, setActiveSection] = useState<'revenue' | 'inventory' | 'events' | 'suppliers'>('revenue');

  // Fetch dashboard data with error handling and default values
  const { data: stats = DEFAULT_DASHBOARD_STATS, isLoading, error } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  // Fetch predictive insights with error handling
  const { data: insights = [] } = useQuery<PredictiveInsight[]>({
    queryKey: ["/api/dashboard/insights"],
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
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

  // Get current revenue metric based on selected timeframe with proper default handling
  const getCurrentRevenue = (): RevenueMetric => {
    const revenue = (() => {
      switch (selectedTimeframe) {
        case 'day':
          return stats?.dailyRevenue;
        case 'week':
          return stats?.weeklyRevenue;
        case 'month':
          return stats?.monthlyRevenue;
        case 'year':
          return stats?.yearlyRevenue;
        default:
          return DEFAULT_REVENUE_METRIC;
      }
    })();
    return revenue || DEFAULT_REVENUE_METRIC;
  };

  const currentRevenue = getCurrentRevenue();

  // Calculate average profit margin with defensive coding
  const averageProfitMargin = stats?.categoryPerformance?.length
    ? stats.categoryPerformance.reduce((acc, cat) => acc + (cat?.profitMargin || 0), 0) / stats.categoryPerformance.length
    : 0;

  // Safe access helper for chart data
  const getSafeChartData = <T extends { [key: string]: any }>(data: T[] | undefined | null): T[] => {
    return Array.isArray(data) ? data : [];
  };

  return (
    <div className="min-h-screen bg-background">
      <NavBar />

      <div className="container mx-auto p-4 lg:p-8">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Dashboard</h1>
          <p className="text-sm md:text-base text-muted-foreground">Real-time insights and analytics</p>
        </div>

        {/* AI Insights Banner - Mobile Optimized */}
        {insights && insights.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 overflow-x-auto"
          >
            <Card className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-none shadow-xl">
              <CardContent className="p-4 md:p-6">
                <div className="flex flex-col space-y-4">
                  <h3 className="text-base md:text-lg font-semibold text-primary">AI-Powered Insights</h3>
                  <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 min-w-[280px]">
                    {insights.map((insight, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-start gap-3 p-4 rounded-lg bg-white/50 dark:bg-gray-800/50"
                      >
                        <div className={`p-2 rounded-full shrink-0 ${
                          insight.impact === 'positive' ? 'bg-green-500/10' :
                            insight.impact === 'negative' ? 'bg-red-500/10' : 'bg-blue-500/10'
                        }`}>
                          {insight.type === 'trend' ? <TrendingUp className="h-4 w-4 md:h-5 md:w-5" /> :
                            insight.type === 'alert' ? <AlertCircle className="h-4 w-4 md:h-5 md:w-5" /> :
                            <Percent className="h-4 w-4 md:h-5 md:w-5" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium line-clamp-2">{insight.message}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Confidence: {insight.confidence}%
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Main Navigation Tabs - Mobile Optimized */}
        <Tabs defaultValue="revenue" className="mb-8 space-y-4" onValueChange={(value) => setActiveSection(value as any)}>
          <TabsList className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4 bg-transparent w-full overflow-x-auto">
            <TabsTrigger value="revenue" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-2 md:px-4">
              <DollarSign className="h-4 w-4 mr-1 md:mr-2 shrink-0" />
              <span className="truncate">Revenue</span>
            </TabsTrigger>
            <TabsTrigger value="inventory" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-2 md:px-4">
              <Package className="h-4 w-4 mr-1 md:mr-2 shrink-0" />
              <span className="truncate">Inventory</span>
            </TabsTrigger>
            <TabsTrigger value="events" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-2 md:px-4">
              <CalendarIcon className="h-4 w-4 mr-1 md:mr-2 shrink-0" />
              <span className="truncate">Events</span>
            </TabsTrigger>
            <TabsTrigger value="suppliers" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-2 md:px-4">
              <Truck className="h-4 w-4 mr-1 md:mr-2 shrink-0" />
              <span className="truncate">Suppliers</span>
            </TabsTrigger>
          </TabsList>

          {/* Revenue Tab Content - Mobile Optimized */}
          <TabsContent value="revenue">
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
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
                          <p className="text-sm text-muted-foreground">
                            {selectedTimeframe.charAt(0).toUpperCase() + selectedTimeframe.slice(1)} Revenue
                          </p>
                          <p className="text-2xl font-bold">
                            ${((currentRevenue?.amount || 0) / 100).toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            })}
                          </p>
                        </div>
                      </div>
                      {(currentRevenue?.growth || 0) > 0 ? (
                        <div className="flex items-center text-emerald-500">
                          <ArrowUpRight className="h-4 w-4" />
                          <span className="text-sm font-medium">+{currentRevenue?.growth || 0}%</span>
                        </div>
                      ) : (
                        <div className="flex items-center text-red-500">
                          <ArrowDownRight className="h-4 w-4" />
                          <span className="text-sm font-medium">{currentRevenue?.growth || 0}%</span>
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
                            ${((stats?.averageOrderValue || 0) / 100).toLocaleString('en-US', {
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
                            {averageProfitMargin.toFixed(1)}%
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
                          <p className="text-2xl font-bold">{stats?.lowStockItems?.length || 0}</p>
                        </div>
                      </div>
                      {(stats?.expiringItems?.length || 0) > 0 && (
                        <div className="flex items-center text-amber-500">
                          <AlertCircle className="h-4 w-4" />
                          <span className="text-sm font-medium ml-1">
                            {stats?.expiringItems?.length || 0} expiring
                          </span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Charts Section - Mobile Optimized */}
            <div className="grid gap-6 grid-cols-1 lg:grid-cols-2 mt-6">
              {/* Revenue Trend Chart */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="w-full min-h-[300px] md:min-h-[400px]"
              >
                <Card className="bg-white/95 backdrop-blur-md border-white/20 shadow-xl h-full">
                  <CardHeader className="border-b border-gray-100/10">
                    <CardTitle className="flex items-center gap-2 text-base md:text-lg font-medium">
                      <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-blue-500" />
                      Revenue Trend
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 md:pt-6 h-[300px] md:h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={getSafeChartData(stats?.liveSales)}
                        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                      >
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
                  </CardContent>
                </Card>
              </motion.div>

              {/* Category Performance Chart */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.5 }}
                className="w-full min-h-[300px] md:min-h-[400px]"
              >
                <Card className="bg-white/95 backdrop-blur-md border-white/20 shadow-xl h-full">
                  <CardHeader className="border-b border-gray-100/10">
                    <CardTitle className="flex items-center gap-2 text-base md:text-lg font-medium">
                      <BarChart3 className="h-4 w-4 md:h-5 md:w-5 text-emerald-500" />
                      Category Performance
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 md:pt-6 h-[300px] md:h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={getSafeChartData(stats?.categoryPerformance)}
                        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                      >
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
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </TabsContent>

          {/* Events Tab Content */}
          <TabsContent value="events">
            <div className="grid gap-6">
              {/* Upcoming Events Overview */}
              <Card className="bg-white/95 backdrop-blur-md border-white/20 shadow-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary" />
                    Upcoming Events
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Add event list items here */}
                  </div>
                </CardContent>
              </Card>

              {/* Event Analytics */}
              <div className="grid gap-6 md:grid-cols-2">
                {/* Event Revenue Chart */}
                <Card className="bg-white/95 backdrop-blur-md border-white/20 shadow-xl">
                  <CardHeader>
                    <CardTitle>Event Revenue Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          {/* Add event revenue pie chart */}
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Package Performance */}
                <Card className="bg-white/95 backdrop-blur-md border-white/20 shadow-xl">
                  <CardHeader>
                    <CardTitle>Bar Package Performance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart>
                          {/* Add bar package performance chart */}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Suppliers Tab Content */}
          <TabsContent value="suppliers">
            <div className="grid gap-6">
              {/* Supplier Performance Overview */}
              <Card className="bg-white/95 backdrop-blur-md border-white/20 shadow-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Truck className="h-5 w-5 text-primary" />
                    Supplier Performance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Add supplier performance metrics */}
                  </div>
                </CardContent>
              </Card>

              {/* Procurement Analytics */}
              <div className="grid gap-6 md:grid-cols-2">
                {/* Cost Analysis */}
                <Card className="bg-white/95 backdrop-blur-md border-white/20 shadow-xl">
                  <CardHeader>
                    <CardTitle>Procurement Cost Analysis</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart>
                          {/* Add procurement cost analysis chart */}
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Supplier Ratings */}
                <Card className="bg-white/95 backdrop-blur-md border-white/20 shadow-xl">
                  <CardHeader>
                    <CardTitle>Supplier Quality Scores</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart>
                          {/* Add supplier ratings chart */}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
        {/* Top Products & Inventory Alerts - Mobile Optimized */}
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
          >
            <Card className="bg-white/95 backdrop-blur-md border-white/20 shadow-xl">
              <CardHeader className="border-b border-gray-100/10">
                <CardTitle className="flex items-center gap-2 text-base md:text-lg font-medium">
                  <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-amber-500" />
                  Top Selling Products
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 md:pt-6">
                <div className="space-y-4">
                  {stats?.topProducts?.map((product, index) => (
                    <motion.div
                      key={product?.id || index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                      className="flex items-center justify-between p-4 rounded-lg bg-gray-50/50"
                    >
                      <div>
                        <p className="font-medium">{product?.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {product?.category} • {product?.quantity} units
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">
                          ${((product?.revenue || 0) / 100).toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          })}
                        </p>
                        <p className="text-sm text-emerald-500">
                          {product?.profitMargin}% margin
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
                <CardTitle className="flex items-center gap-2 text-base md:text-lg font-medium">
                  <AlertOctagon className="h-4 w-4 md:h-5 md:w-5 text-amber-500" />
                  Inventory Alerts
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 md:pt-6">
                <div className="space-y-4">
                  {stats?.lowStockItems?.map((item, index) => (
                    <motion.div
                      key={item?.id || index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                      className="p-4 rounded-lg bg-gray-50/50"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-medium">{item?.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Current stock: {item?.currentStock}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-amber-500">
                            Min required: {item?.minRequired}
                          </p>
                          {item?.expiryDate && (
                            <p className="text-sm text-red-500">
                              Expires: {new Date(item.expiryDate).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                      {item?.supplierName && (
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