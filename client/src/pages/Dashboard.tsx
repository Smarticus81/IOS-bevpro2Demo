import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NavBar } from "@/components/NavBar";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { DollarSign, TrendingUp, Users, Package, Loader2 } from "lucide-react";
import type { Drink } from "@db/schema";

interface DashboardStats {
  totalSales: number;
  todaySales: number;
  activeOrders: number;
  totalCustomers: number;
  categorySales: Array<{ category: string; totalSales: number }>;
  weeklyTrend: Array<{ date: string; sales: number }>;
  popularDrinks: Array<{ id: number; name: string; sales: number }>;
  totalOrders: number;
}

export function Dashboard() {
  const [activeCategory, setActiveCategory] = useState<string | undefined>();
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month' | 'year'>('week');
  const [chartType, setChartType] = useState<'bar' | 'line' | 'pie'>('bar');

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

  // Chart colors
  const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD'];

  return (
    <div className="min-h-screen bg-background">
      <NavBar />

      <div className="container mx-auto p-4 lg:p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard</h1>
          <p className="text-muted-foreground">Welcome to your beverage management dashboard</p>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 backdrop-blur-md border-white/20 shadow-xl">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-blue-500/10 rounded-full">
                  <DollarSign className="h-8 w-8 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Sales</p>
                  <p className="text-2xl font-bold">${(stats?.totalSales / 100).toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 backdrop-blur-md border-white/20 shadow-xl">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-green-500/10 rounded-full">
                  <TrendingUp className="h-8 w-8 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Today's Sales</p>
                  <p className="text-2xl font-bold">${(stats?.todaySales / 100).toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 backdrop-blur-md border-white/20 shadow-xl">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-purple-500/10 rounded-full">
                  <Package className="h-8 w-8 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active Orders</p>
                  <p className="text-2xl font-bold">{stats?.activeOrders}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 backdrop-blur-md border-white/20 shadow-xl">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-orange-500/10 rounded-full">
                  <Users className="h-8 w-8 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active Customers</p>
                  <p className="text-2xl font-bold">{stats?.totalCustomers}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Popular Drinks Chart */}
        <Card className="bg-white/90 backdrop-blur-md border-white/20 shadow-xl mb-8">
          <CardHeader>
            <CardTitle>Popular Drinks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={stats?.popularDrinks}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" vertical={false} />
                  <XAxis 
                    dataKey="name"
                    className="text-xs font-medium"
                    tick={{ fill: 'currentColor' }}
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                    height={60}
                    angle={-45}
                    textAnchor="end"
                  />
                  <YAxis 
                    className="text-xs font-medium"
                    tick={{ fill: 'currentColor' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${value}`}
                  />
                  <Tooltip
                    cursor={{ fill: 'hsl(var(--muted))' }}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      borderColor: 'hsl(var(--border))',
                      borderRadius: 'var(--radius)',
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    }}
                    formatter={(value: number) => [`${value} sales`, 'Sales']}
                  />
                  <Bar 
                    dataKey="sales"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={50}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Additional Charts Row */}
        <div className="grid gap-4 md:grid-cols-2 mt-8">
          {/* Category Distribution */}
          <Card className="bg-white/90 backdrop-blur-md border-white/20 shadow-xl">
            <CardHeader>
              <CardTitle>Category Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats?.categorySales}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="totalSales"
                    >
                      {stats?.categorySales.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        borderColor: 'hsl(var(--border))',
                        borderRadius: 'var(--radius)',
                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                      }}
                      formatter={(value: number) => [`${value} sales`, 'Sales']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Sales Trend */}
          <Card className="bg-white/90 backdrop-blur-md border-white/20 shadow-xl">
            <CardHeader>
              <CardTitle>Weekly Sales Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats?.weeklyTrend}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" vertical={false} />
                    <XAxis 
                      dataKey="date"
                      className="text-xs font-medium"
                      tick={{ fill: 'currentColor' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      className="text-xs font-medium"
                      tick={{ fill: 'currentColor' }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `$${(value / 100).toFixed(0)}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        borderColor: 'hsl(var(--border))',
                        borderRadius: 'var(--radius)',
                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                      }}
                      formatter={(value: number) => [`$${(value / 100).toFixed(2)}`, 'Sales']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="sales" 
                      stroke="#FF6B6B"
                      strokeWidth={2}
                      dot={{ fill: '#FF6B6B', strokeWidth: 2 }}
                      activeDot={{ r: 8 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}