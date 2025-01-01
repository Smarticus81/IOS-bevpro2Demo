import { useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Drink, PourInventory, TaxCategory, PourTransaction } from "@db/schema";
import { TrendingUp, BarChart3, PieChart as PieChartIcon } from "lucide-react";

interface InventoryVisualizationsProps {
  drinks: Drink[];
  pourInventory: PourInventory[];
  taxCategories: TaxCategory[];
  pourTransactions: PourTransaction[];
}

export function InventoryVisualizations({ 
  drinks, 
  pourInventory, 
  taxCategories,
  pourTransactions 
}: InventoryVisualizationsProps) {
  // Calculate revenue trends
  const revenueTrends = pourTransactions.reduce((acc, trans) => {
    const date = new Date(trans.transaction_time).toLocaleDateString();
    if (!acc[date]) {
      acc[date] = {
        date,
        revenue: 0,
        transactions: 0
      };
    }
    const drink = drinks.find(d => {
      const inventory = pourInventory.find(i => i.id === trans.pour_inventory_id);
      return d.id === inventory?.drink_id;
    });
    acc[date].revenue += Number(drink?.price || 0);
    acc[date].transactions++;
    return acc;
  }, {} as Record<string, { date: string; revenue: number; transactions: number }>);

  const revenueData = Object.values(revenueTrends).slice(-7); // Last 7 days

  // Calculate category performance
  const categoryPerformance = drinks.reduce((acc, drink) => {
    if (!acc[drink.category]) {
      acc[drink.category] = {
        category: drink.category,
        revenue: 0,
        volume: 0,
        items: 0
      };
    }
    acc[drink.category].revenue += (drink.price * (drink.sales || 0));
    acc[drink.category].volume += drink.inventory;
    acc[drink.category].items++;
    return acc;
  }, {} as Record<string, { category: string; revenue: number; volume: number; items: number }>);

  const categoryData = Object.values(categoryPerformance);

  // Top selling items
  const topSellers = drinks
    .filter(d => d.sales && d.sales > 0)
    .sort((a, b) => (b.sales || 0) - (a.sales || 0))
    .slice(0, 5)
    .map(d => ({
      name: d.name,
      sales: d.sales || 0,
      revenue: d.price * (d.sales || 0)
    }));

  const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD'];

  return (
    <div className="space-y-6">
      {/* Revenue Trends */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="bg-white/90 backdrop-blur-md border-white/20 shadow-xl overflow-hidden">
          <CardHeader className="border-b border-gray-100">
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
                      <stop offset="5%" stopColor="#60A5FA" stopOpacity={0.1}/>
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

      {/* Category Performance and Top Sellers */}
      <div className="grid gap-6 md:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card className="bg-white/90 backdrop-blur-md border-white/20 shadow-xl overflow-hidden">
            <CardHeader className="border-b border-gray-100">
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
                      fill="#10B981"
                      radius={[4, 4, 0, 0]}
                    >
                      {categoryData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <Card className="bg-white/90 backdrop-blur-md border-white/20 shadow-xl overflow-hidden">
            <CardHeader className="border-b border-gray-100">
              <CardTitle className="flex items-center gap-2 text-lg font-medium">
                <PieChartIcon className="h-5 w-5 text-purple-500" />
                Top Selling Items
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={topSellers}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="revenue"
                    >
                      {topSellers.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '0.5rem',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      }}
                      formatter={(value: number) => [`$${value.toFixed(2)}`, 'Revenue']}
                    />
                    <Legend 
                      verticalAlign="bottom" 
                      height={36}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}