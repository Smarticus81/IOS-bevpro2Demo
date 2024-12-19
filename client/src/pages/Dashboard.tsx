import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NavBar } from "@/components/NavBar";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DollarSign, TrendingUp, Users, Package } from "lucide-react";
import type { Drink } from "@db/schema";

interface SalesData {
  totalSales: number;
  todaySales: number;
  activeOrders: number;
  totalCustomers: number;
}

export function Dashboard() {
  const { data: drinks = [] } = useQuery<Drink[]>({
    queryKey: ["/api/drinks"],
  });

  // In a real app, this would come from the API
  const salesData: SalesData = {
    totalSales: 15420,
    todaySales: 1240,
    activeOrders: 8,
    totalCustomers: 142
  };

  const popularDrinks = drinks
    .sort((a, b) => (b.sales || 0) - (a.sales || 0))
    .slice(0, 5)
    .map(drink => ({
      name: drink.name,
      sales: drink.sales || 0
    }));

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
          <Card className="bg-white/90 backdrop-blur-md border-white/20 shadow-xl">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <DollarSign className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Sales</p>
                  <p className="text-2xl font-bold">${salesData.totalSales.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/90 backdrop-blur-md border-white/20 shadow-xl">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <TrendingUp className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Today's Sales</p>
                  <p className="text-2xl font-bold">${salesData.todaySales.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/90 backdrop-blur-md border-white/20 shadow-xl">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <Package className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Active Orders</p>
                  <p className="text-2xl font-bold">{salesData.activeOrders}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/90 backdrop-blur-md border-white/20 shadow-xl">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <Users className="h-8 w-8 text-purple-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Customers</p>
                  <p className="text-2xl font-bold">{salesData.totalCustomers}</p>
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
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={popularDrinks}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="name"
                    className="text-xs"
                    tick={{ fill: 'currentColor' }}
                  />
                  <YAxis 
                    className="text-xs"
                    tick={{ fill: 'currentColor' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      borderColor: 'hsl(var(--border))',
                      borderRadius: 'var(--radius)'
                    }}
                  />
                  <Bar 
                    dataKey="sales"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
