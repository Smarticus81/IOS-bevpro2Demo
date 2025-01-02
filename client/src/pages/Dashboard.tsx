import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NavBar } from "@/components/NavBar";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Area, AreaChart } from 'recharts';
import { DollarSign, TrendingUp, Users, Package, Loader2, Calendar, BarChart3, Clock, AlertCircle, ShoppingCart, ArrowUpRight, ArrowDownRight } from "lucide-react";
import type { Drink, Order, OrderItem } from "@db/schema";
import { motion } from "framer-motion";

interface DashboardStats {
  totalSales: number;
  todaySales: number;
  activeOrders: number;
  totalCustomers: number;
  categorySales: Array<{ category: string; totalSales: number }>;
  weeklyTrend: Array<{ date: string; sales: number }>;
  popularDrinks: Array<{ id: number; name: string; sales: number }>;
  totalOrders: number;
  // Additional stats
  monthlyGrowth: number;
  weeklyGrowth: number;
  averageOrderValue: number;
  orderFulfillmentTime: number;
  lowStockItems: number;
  topSellingItems: Array<{ name: string; revenue: number; quantity: number }>;
  inventoryValue: number;
  systemUptime: number;
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
  }
};

export function Dashboard() {
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

  // Default data for optional properties
  const defaultStats: Partial<DashboardStats> = {
    topSellingItems: [],
    monthlyGrowth: 0,
    averageOrderValue: 0,
    orderFulfillmentTime: 0,
    lowStockItems: 0,
    inventoryValue: 0,
    systemUptime: 100,
    activeOrders: 0,
  };

  // Merge default values with actual data
  const dashboardStats = { ...defaultStats, ...stats };

  return (
    <div className="min-h-screen bg-background">
      <NavBar />

      <div className="container mx-auto p-4 lg:p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard</h1>
          <p className="text-muted-foreground">Welcome to your beverage management dashboard</p>
        </div>

        {/* Revenue Overview Section */}
        <div className="grid gap-4 md:grid-cols-4 mb-8">
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
                      <p className="text-sm text-muted-foreground">Total Revenue</p>
                      <p className="text-2xl font-bold">
                        ${((dashboardStats.totalSales || 0) / 100).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </p>
                    </div>
                  </div>
                  {typeof dashboardStats.monthlyGrowth === 'number' && (
                    dashboardStats.monthlyGrowth > 0 ? (
                      <div className="flex items-center text-emerald-500">
                        <ArrowUpRight className="h-4 w-4" />
                        <span className="text-sm font-medium">+{dashboardStats.monthlyGrowth}%</span>
                      </div>
                    ) : (
                      <div className="flex items-center text-red-500">
                        <ArrowDownRight className="h-4 w-4" />
                        <span className="text-sm font-medium">{dashboardStats.monthlyGrowth}%</span>
                      </div>
                    )
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Average Order Card */}
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
                      <p className="text-sm text-muted-foreground">Average Order</p>
                      <p className="text-2xl font-bold">
                        ${((dashboardStats.averageOrderValue || 0) / 100).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center text-emerald-500">
                    <span className="text-sm font-medium">{dashboardStats.totalOrders || 0} orders</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Order Processing Card */}
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
                      <Clock className="h-8 w-8 text-purple-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Avg. Fulfillment</p>
                      <p className="text-2xl font-bold">{dashboardStats.orderFulfillmentTime}m</p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <span className="text-sm font-medium text-purple-500">Active: {dashboardStats.activeOrders}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Inventory Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Card className="bg-gradient-to-br from-pink-50 to-pink-100 dark:from-pink-900/20 dark:to-pink-800/20 
                          backdrop-blur-md border-white/20 shadow-xl hover:shadow-2xl transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-pink-500/10 rounded-full">
                      <Package className="h-8 w-8 text-pink-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Inventory Value</p>
                      <p className="text-2xl font-bold">
                        ${((dashboardStats.inventoryValue || 0) / 100).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </p>
                    </div>
                  </div>
                  {dashboardStats.lowStockItems > 0 && (
                    <div className="flex items-center text-amber-500">
                      <AlertCircle className="h-4 w-4" />
                      <span className="text-sm font-medium ml-1">{dashboardStats.lowStockItems} low</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Revenue Trends & Category Performance */}
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
                    <AreaChart data={dashboardStats.weeklyTrend || []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={GRADIENTS.primary.start} stopOpacity={0.2}/>
                          <stop offset="95%" stopColor={GRADIENTS.primary.end} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200/30" />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
                        tickLine={false}
                        axisLine={{ stroke: 'hsl(var(--border))' }}
                      />
                      <YAxis
                        tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
                        tickLine={false}
                        axisLine={{ stroke: 'hsl(var(--border))' }}
                        tickFormatter={(value: number) => `$${(value / 100).toFixed(0)}`}
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
                        dataKey="sales"
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
                    <BarChart data={dashboardStats.categorySales || []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--background))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '0.75rem',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
                        }}
                      />
                      <Bar
                        dataKey="totalSales"
                        fill="url(#barGradient)"
                        radius={[6, 6, 0, 0]}
                      >
                        {(dashboardStats.categorySales || []).map((_, index) => (
                          <motion.rect
                            key={`bar-${index}`}
                            initial={{ y: 300, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{
                              duration: 0.5,
                              delay: index * 0.1,
                              ease: "easeOut"
                            }}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Top Selling Items & Order Metrics */}
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
                  Top Selling Items
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {dashboardStats.topSellingItems?.map((item, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                      className="flex items-center justify-between p-4 rounded-lg bg-gray-50/50"
                    >
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.quantity} units sold
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">
                          ${(item.revenue / 100).toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          })}
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
                  <Clock className="h-5 w-5 text-violet-500" />
                  System Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-gray-50/50">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium">System Uptime</p>
                      <p className="text-sm font-medium">{dashboardStats.systemUptime}%</p>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${dashboardStats.systemUptime}%` }}
                        transition={{ duration: 0.5, delay: 0.8 }}
                        className="bg-violet-500 h-2 rounded-full"
                      />
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-gray-50/50">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium">Order Processing</p>
                      <p className="text-sm font-medium">{dashboardStats.orderFulfillmentTime}m avg</p>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>{dashboardStats.activeOrders} orders in queue</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-gray-50/50">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium">Inventory Status</p>
                      <p className="text-sm font-medium">{dashboardStats.lowStockItems} items low</p>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Package className="h-4 w-4" />
                      <span>${(dashboardStats.inventoryValue / 100).toLocaleString()} total value</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}