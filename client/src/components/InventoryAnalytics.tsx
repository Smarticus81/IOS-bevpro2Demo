import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package } from "lucide-react";

interface Drink {
  id: number;
  name: string;
  category: string;
  subcategory: string | null;
  price: number;
  inventory: number;
  sales: number;
  image?: string;
}

interface PourTransaction {
  id: number;
  drink_name: string;
  drink_category: string;
  volume_ml: number;
  staff_id: number;
  tax_amount: number;
  transaction_time: string;
  pour_size_id: number | null;
}

interface InventoryAnalyticsProps {
  drinks: Drink[];
  inventoryHistory?: PourTransaction[];
}

interface ChartData {
  category: string;
  totalItems: number;
  lowStock: number;
  averageInventory: number;
  items: Drink[];
}

export function InventoryAnalytics({ drinks, inventoryHistory = [] }: InventoryAnalyticsProps) {
  // Transform data for the inventory levels chart
  const inventoryData = drinks.reduce((acc, drink) => {
    const category = drink.category;
    if (!acc[category]) {
      acc[category] = {
        category,
        totalItems: 0,
        lowStock: 0,
        averageInventory: 0,
        items: []
      };
    }

    acc[category].items.push(drink);
    acc[category].totalItems++;
    if (drink.inventory < 10) {
      acc[category].lowStock++;
    }
    acc[category].averageInventory += drink.inventory;

    return acc;
  }, {} as Record<string, ChartData>);

  const chartData = Object.values(inventoryData).map(data => ({
    ...data,
    averageInventory: Math.round(data.averageInventory / data.totalItems)
  })).sort((a, b) => b.averageInventory - a.averageInventory);

  // iOS-style color palette
  const COLORS = {
    primary: '#007AFF', // iOS blue
    chart: {
      grid: '#E5E5EA',
      text: '#8E8E93',
    }
  };

  const formatTooltipContent = (value: number, name: string) => {
    const data = inventoryData[name];
    if (!data) return null;

    return [
      <div key={name} className="space-y-1 text-sm">
        <div>Average Inventory: {value}</div>
        <div>Total Items: {data.totalItems}</div>
        <div>Low Stock Items: {data.lowStock}</div>
      </div>,
      'Inventory Status'
    ];
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-6"
    >
      <Card className="border border-gray-100 bg-white">
        <CardHeader className="px-4 py-3 border-b border-gray-100">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Package className="h-4 w-4 text-blue-500" />
            Inventory Levels by Category
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
                  label={{ value: 'Average Inventory', angle: -90, position: 'insideLeft', fill: COLORS.chart.text }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #E5E5EA',
                    borderRadius: '8px',
                    padding: '8px 12px',
                  }}
                  formatter={formatTooltipContent}
                />
                <Bar
                  dataKey="averageInventory"
                  fill={COLORS.primary}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}