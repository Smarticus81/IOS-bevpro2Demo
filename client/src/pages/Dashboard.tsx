import { Suspense, lazy } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NavBar } from "@/components/NavBar";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import type { DashboardStats } from "@/types/dashboard";
import { Button } from "@/components/ui/button";
import { useState } from "react";

// Lazy load chart components to reduce initial bundle size
const DashboardCharts = lazy(() => import("@/components/DashboardCharts"));
const TopProducts = lazy(() => import("@/components/TopProducts"));
const InventoryAlerts = lazy(() => import("@/components/InventoryAlerts"));

export function Dashboard() {
  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  // Fetch dashboard data with pagination
  const { data: stats, isLoading, error } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats", page, limit],
    keepPreviousData: true // Keep showing previous data while fetching new page
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

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <div className="container mx-auto p-4 lg:p-8">
        {/* Header Section */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Dashboard</h1>
          <p className="text-sm md:text-base text-muted-foreground">Real-time insights and analytics</p>
        </div>

        {/* Wrap lazy loaded components in Suspense */}
        <Suspense
          fallback={
            <div className="w-full h-64 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          }
        >
          <DashboardCharts stats={stats} />
        </Suspense>

        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2 mt-6">
          <Suspense
            fallback={
              <div className="w-full h-64 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            }
          >
            <TopProducts products={stats?.topProducts} /> {/*Corrected prop name here*/}
          </Suspense>

          <Suspense
            fallback={
              <div className="w-full h-64 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            }
          >
            <InventoryAlerts items={stats?.lowStockItems} />
          </Suspense>
        </div>

        {/* Pagination Controls */}
        {stats?.pagination && (
          <div className="mt-6 flex justify-center">
            <Button
              variant="outline"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="mr-2"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              onClick={() => setPage((p) => p + 1)}
              disabled={!stats.pagination.hasMore}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;