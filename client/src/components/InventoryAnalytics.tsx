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

  // iOS-style color palette
  const COLORS = {
    primary: '#007AFF', // iOS blue
    secondary: '#34C759', // iOS green
    chart: {
      grid: '#E5E5EA',
      text: '#8E8E93',
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 mb-6">
      {/* Revenue Performance */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="border border-gray-100 bg-white">
          <CardHeader className="px-4 py-3 border-b border-gray-100">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              Revenue Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.1}/>
                      <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={COLORS.chart.grid} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: COLORS.chart.text, fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: COLORS.chart.grid }}
                  />
                  <YAxis
                    tick={{ fill: COLORS.chart.text, fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: COLORS.chart.grid }}
                    tickFormatter={(value) => `$${value}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #E5E5EA',
                      borderRadius: '8px',
                      padding: '8px 12px',
                    }}
                    formatter={(value: number) => [`$${value.toFixed(2)}`, 'Revenue']}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke={COLORS.primary}
                    strokeWidth={2}
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
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <Card className="border border-gray-100 bg-white">
          <CardHeader className="px-4 py-3 border-b border-gray-100">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <BarChart3 className="h-4 w-4 text-green-500" />
              Category Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={COLORS.chart.grid} />
                  <XAxis
                    dataKey="category"
                    tick={{ fill: COLORS.chart.text, fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: COLORS.chart.grid }}
                  />
                  <YAxis
                    tick={{ fill: COLORS.chart.text, fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: COLORS.chart.grid }}
                    tickFormatter={(value) => `$${value}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #E5E5EA',
                      borderRadius: '8px',
                      padding: '8px 12px',
                    }}
                    formatter={(value: number) => [`$${value.toFixed(2)}`, 'Revenue']}
                  />
                  <Bar
                    dataKey="revenue"
                    fill={COLORS.secondary}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}