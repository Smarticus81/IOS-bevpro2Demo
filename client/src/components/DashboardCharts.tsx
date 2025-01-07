import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import type { DashboardStats } from "@/types/dashboard";
import { motion } from "framer-motion";

interface Props {
  stats?: DashboardStats;
}

export default function DashboardCharts({ stats }: Props) {
  if (!stats) return null;

  return (
    <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
      {/* Sales Overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full min-h-[300px]"
      >
        <Card>
          <CardHeader>
            <CardTitle>Sales Overview</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={stats.categorySales}
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="total" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#82ca9d" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="category" 
                  className="text-muted-foreground text-xs"
                />
                <YAxis 
                  className="text-muted-foreground text-xs"
                  tickFormatter={(value) => `${value}`}
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
                  dataKey="totalSales"
                  stroke="#82ca9d"
                  fillOpacity={1}
                  fill="url(#total)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </motion.div>

      {/* Category Distribution */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full min-h-[300px]"
      >
        <Card>
          <CardHeader>
            <CardTitle>Category Distribution</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stats.categorySales}
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="category" 
                  className="text-muted-foreground text-xs"
                />
                <YAxis 
                  className="text-muted-foreground text-xs"
                  tickFormatter={(value) => `${value}`}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '0.5rem',
                  }}
                />
                <Bar 
                  dataKey="totalSales" 
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
