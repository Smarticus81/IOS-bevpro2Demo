import { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend
} from "recharts";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, BarChart3 } from "lucide-react";
import type { Drink, PourTransaction } from "@db/schema";

interface InventoryAnalyticsProps {
  drinks: Drink[];
  inventoryHistory: PourTransaction[];
}

export function InventoryAnalytics({ drinks, inventoryHistory }: InventoryAnalyticsProps) {
  // Calculate revenue trends with proper decimal handling
  const revenueTrends = inventoryHistory.reduce((acc, trans) => {
    const date = trans.transaction_time ? 
      new Date(trans.transaction_time).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      }) : 
      new Date().toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });

    if (!acc[date]) {
      acc[date] = {
        date,
        revenue: 0,
        transactions: 0,
      };
    }

    const drink = drinks.find(d => d.id === trans.pour_inventory_id);
    if (drink) {
      // Handle potential decimal values
      const price = Number(drink.price) || 0;
      acc[date].revenue += price;
      acc[date].transactions++;
    }
    return acc;
  }, {} as Record<string, { date: string; revenue: number; transactions: number }>);

  const revenueData = Object.values(revenueTrends)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-7);

  // Calculate category performance with proper aggregation
  const categoryPerformance = drinks.reduce((acc, drink) => {
    if (!acc[drink.category]) {
      acc[drink.category] = {
        category: drink.category,
        revenue: 0,
        volume: 0,
        transactions: 0
      };
    }

    const sales = drink.sales || 0;
    const price = Number(drink.price) || 0;
    acc[drink.category].revenue += price * sales;
    acc[drink.category].volume += drink.inventory;
    acc[drink.category].transactions += sales;

    return acc;
  }, {} as Record<string, { 
    category: string; 
    revenue: number; 
    volume: number;
    transactions: number;
  }>);

  const categoryData = Object.values(categoryPerformance)
    .sort((a, b) => b.revenue - a.revenue);

  // Premium color palette
  const GRADIENTS = {
    primary: {
      start: '#60A5FA',
      end: '#3B82F6'
    },
    secondary: {
      start: '#10B981',
      end: '#059669'
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-2 mb-8">
      {/* Revenue Performance */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <Card className="bg-white/95 backdrop-blur-md border-white/20 
                      shadow-[0_8px_16px_rgba(0,0,0,0.1)]
                      hover:shadow-[0_12px_24px_rgba(0,0,0,0.15)]
                      transition-all duration-300">
          <CardHeader className="border-b border-gray-100/10 pb-4">
            <CardTitle className="flex items-center gap-2 text-lg font-medium">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              Revenue Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
                    tickFormatter={(value) => `$${value}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '0.75rem',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
                    }}
                    formatter={(value: number) => [`$${value.toFixed(2)}`, 'Revenue']}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
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

      {/* Category Performance */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut", delay: 0.2 }}
      >
        <Card className="bg-white/95 backdrop-blur-md border-white/20 
                      shadow-[0_8px_16px_rgba(0,0,0,0.1)]
                      hover:shadow-[0_12px_24px_rgba(0,0,0,0.15)]
                      transition-all duration-300">
          <CardHeader className="border-b border-gray-100/10 pb-4">
            <CardTitle className="flex items-center gap-2 text-lg font-medium">
              <BarChart3 className="h-5 w-5 text-emerald-500" />
              Category Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
                    tickFormatter={(value) => `$${value}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '0.75rem',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
                    }}
                    formatter={(value: number) => [`$${value.toFixed(2)}`, 'Revenue']}
                  />
                  <Bar
                    dataKey="revenue"
                    radius={[6, 6, 0, 0]}
                    fill="url(#barGradient)"
                  >
                    {categoryData.map((_, index) => (
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
  );
}