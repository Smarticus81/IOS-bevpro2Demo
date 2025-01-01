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
  // Calculate revenue trends
  const revenueTrends = inventoryHistory.reduce((acc, trans) => {
    const date = trans.transaction_time ? new Date(trans.transaction_time).toLocaleDateString() : new Date().toLocaleDateString();
    if (!acc[date]) {
      acc[date] = {
        date,
        revenue: 0,
        transactions: 0
      };
    }
    const drink = drinks.find(d => d.id === trans.pour_inventory_id);
    if (drink) {
      acc[date].revenue += drink.price;
      acc[date].transactions++;
    }
    return acc;
  }, {} as Record<string, { date: string; revenue: number; transactions: number }>);

  const revenueData = Object.values(revenueTrends).slice(-7); // Last 7 days

  // Calculate category performance
  const categoryPerformance = drinks.reduce((acc, drink) => {
    if (!acc[drink.category]) {
      acc[drink.category] = {
        category: drink.category,
        revenue: 0,
        volume: 0
      };
    }
    const sales = drink.sales || 0;
    acc[drink.category].revenue += drink.price * sales;
    acc[drink.category].volume += drink.inventory;
    return acc;
  }, {} as Record<string, { category: string; revenue: number; volume: number }>);

  const categoryData = Object.values(categoryPerformance);

  return (
    <div className="grid gap-6 md:grid-cols-2 mb-8">
      {/* Revenue Performance */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <Card className="bg-white/90 backdrop-blur-md border-white/20 shadow-xl overflow-hidden">
          <CardHeader className="border-b border-gray-100/10">
            <CardTitle className="flex items-center gap-2 text-lg font-medium">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              Revenue Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#60A5FA" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#60A5FA" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200/50" />
                  <XAxis 
                    dataKey="date"
                    tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
                    tickLine={false}
                    tickFormatter={(value) => `$${value}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '0.5rem',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#60A5FA"
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
        <Card className="bg-white/90 backdrop-blur-md border-white/20 shadow-xl overflow-hidden">
          <CardHeader className="border-b border-gray-100/10">
            <CardTitle className="flex items-center gap-2 text-lg font-medium">
              <BarChart3 className="h-5 w-5 text-emerald-500" />
              Category Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200/50" />
                  <XAxis
                    dataKey="category"
                    tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
                    tickLine={false}
                    tickFormatter={(value) => `$${value}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '0.5rem',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    }}
                  />
                  <Bar
                    dataKey="revenue"
                    radius={[4, 4, 0, 0]}
                  >
                    {categoryData.map((entry, index) => (
                      <motion.rect
                        key={`cell-${index}`}
                        fill={index % 2 === 0 ? '#10B981' : '#34D399'}
                        initial={{ y: 300, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
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