import type { Drink } from "@db/schema";

export interface DashboardStats {
  totalSales: number;
  todaySales: number;
  activeOrders: number;
  categorySales: Array<{
    category: string;
    totalSales: number;
  }>;
  popularDrinks: Array<{
    id: number;
    name: string;
    sales: number;
  }>;
  totalOrders: number;
  pagination: {
    currentPage: number;
    limit: number;
    hasMore: boolean;
  };
}
