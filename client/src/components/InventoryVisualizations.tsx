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
import { Beer, Wine, Package, TrendingUp } from "lucide-react";

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
  const [activeChart, setActiveChart] = useState<'levels' | 'pours' | 'categories'>('levels');

  // Calculate category-based inventory levels
  const categoryLevels = drinks.reduce((acc, drink) => {
    const category = drink.category;
    if (!acc[category]) {
      acc[category] = {
        name: category,
        total: 0,
        low: 0,
        value: 0
      };
    }
    acc[category].total++;
    acc[category].value += drink.inventory;
    if (drink.inventory < 10) {
      acc[category].low++;
    }
    return acc;
  }, {} as Record<string, { name: string; total: number; low: number; value: number }>);

  const categoryData = Object.values(categoryLevels);

  // Calculate pour volume trends
  const pourTrends = pourTransactions.reduce((acc, trans) => {
    const date = new Date(trans.transaction_time).toLocaleDateString();
    if (!acc[date]) {
      acc[date] = {
        date,
        volume: 0,
        count: 0
      };
    }
    acc[date].volume += trans.volume_ml || 0;
    acc[date].count++;
    return acc;
  }, {} as Record<string, { date: string; volume: number; count: number }>);

  const pourData = Object.values(pourTrends).slice(-7); // Last 7 days

  // Tax category distribution
  const taxData = taxCategories.map(category => ({
    name: category.name,
    value: pourTransactions.reduce((sum, trans) => {
      const inventory = pourInventory.find(i => i.id === trans.pour_inventory_id);
      return sum + (inventory?.tax_category_id === category.id ? (trans.tax_amount || 0) : 0);
    }, 0)
  }));

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="bg-white/90 backdrop-blur-md border-white/20 shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Inventory Levels by Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200/50" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
                  />
                  <YAxis tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '0.5rem'
                    }}
                  />
                  <Legend />
                  <Bar 
                    dataKey="value" 
                    fill="hsl(var(--primary))"
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
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <Card className="bg-white/90 backdrop-blur-md border-white/20 shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
              Pour Volume Trends
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={pourData}>
                  <defs>
                    <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                      <stop 
                        offset="5%" 
                        stopColor="hsl(var(--primary))" 
                        stopOpacity={0.8}
                      />
                      <stop 
                        offset="95%" 
                        stopColor="hsl(var(--primary))" 
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200/50" />
                  <XAxis 
                    dataKey="date"
                    tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
                  />
                  <YAxis 
                    tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '0.5rem'
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="volume"
                    stroke="hsl(var(--primary))"
                    fillOpacity={1}
                    fill="url(#colorVolume)"
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
        transition={{ duration: 0.5, delay: 0.4 }}
        className="md:col-span-2"
      >
        <Card className="bg-white/90 backdrop-blur-md border-white/20 shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wine className="h-5 w-5 text-purple-500" />
              Tax Category Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={taxData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={120}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => 
                      `${name}: ${(percent * 100).toFixed(0)}%`
                    }
                  >
                    {taxData.map((entry, index) => (
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
                      borderRadius: '0.5rem'
                    }}
                    formatter={(value: number) => [`$${value.toFixed(2)}`, 'Tax Amount']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
