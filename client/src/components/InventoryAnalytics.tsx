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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, TrendingUp, ArrowUpRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Drink } from "@db/schema";

interface InventoryAnalyticsProps {
  drinks: Drink[];
  inventoryHistory?: Array<{
    timestamp: string;
    itemId: number;
    quantity: number;
    action: 'in' | 'out';
  }>;
}

export function InventoryAnalytics({ drinks, inventoryHistory = [] }: InventoryAnalyticsProps) {
  // Calculate stock movement data
  const stockMovement = drinks.map(drink => ({
    name: drink.name,
    current: drink.inventory,
    critical: 10,
    predicted: Math.max(0, drink.inventory - (drink.sales || 0)),
  }));

  // Calculate turnover rate
  const turnoverRate = drinks.map(drink => ({
    name: drink.name,
    rate: drink.sales ? (drink.sales / (drink.inventory + drink.sales)) * 100 : 0,
  })).sort((a, b) => b.rate - a.rate).slice(0, 5);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card className="bg-white/90 backdrop-blur-md border-white/20 shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Stock Levels & Predictions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stockMovement}>
                <defs>
                  <linearGradient id="colorInventory" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200/50" />
                <XAxis 
                  dataKey="name"
                  tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '0.5rem',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="current"
                  stroke="hsl(var(--primary))"
                  fillOpacity={1}
                  fill="url(#colorInventory)"
                />
                <Area
                  type="monotone"
                  dataKey="predicted"
                  stroke="hsl(var(--primary))"
                  strokeDasharray="5 5"
                  fill="none"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white/90 backdrop-blur-md border-white/20 shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowUpRight className="h-5 w-5 text-emerald-500" />
            Top Product Turnover
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={turnoverRate}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200/50" />
                <XAxis
                  dataKey="name"
                  tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
                  tickLine={false}
                  label={{ value: 'Turnover Rate (%)', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '0.5rem',
                  }}
                />
                <Bar
                  dataKey="rate"
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
