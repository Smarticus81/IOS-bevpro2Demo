import { useQuery } from "@tanstack/react-query";
import { NavBar } from "@/components/NavBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Transaction {
  id: number;
  order_id: number;
  amount: number;  // Always in cents
  status: string;
  created_at: string;
  metadata: any;
  order: {
    id: number;
    items: Array<{
      drink: {
        id: number;
        name: string;
        category: string;
        price: number;  // Always in cents
      };
      quantity: number;
    }>;
    total: number;  // Always in cents
  };
}

interface TransactionResponse {
  data: Transaction[];
  pagination: {
    currentPage: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
}

export function Transactions() {
  const [search, setSearch] = useState("");

  const { data: transactionResponse, isLoading } = useQuery<TransactionResponse>({
    queryKey: ["/api/transactions"],
  });

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'bg-green-50 text-green-600 border border-green-200';
      case 'pending':
        return 'bg-yellow-50 text-yellow-600 border border-yellow-200';
      case 'failed':
        return 'bg-red-50 text-red-600 border border-red-200';
      default:
        return 'bg-gray-50 text-gray-600 border border-gray-200';
    }
  };

  const filteredTransactions = transactionResponse?.data.filter(transaction => {
    const searchLower = search.toLowerCase();
    return (
      transaction.id.toString().includes(searchLower) ||
      transaction.status.toLowerCase().includes(searchLower) ||
      transaction.amount.toString().includes(searchLower) ||
      transaction.order?.items?.some(item => 
        item.drink.name.toLowerCase().includes(searchLower)
      )
    );
  }) || [];

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getOrderSummary = (items: Transaction['order']['items']) => {
    if (!items?.length) return "No items";
    return items.map(item => `${item.quantity}x ${item.drink.name}`).join(", ");
  };

  // Format monetary values from cents to dollars
  const formatMoney = (cents: number) => {
    const dollars = cents / 100;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(dollars);
  };

  return (
    <div className="min-h-screen bg-white">
      <NavBar />

      <div className="container mx-auto px-4 py-6">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Transaction History</h1>
          <p className="text-gray-500 mt-1">View and manage payment transactions</p>
        </div>

        <Card className="bg-white border border-gray-100">
          <CardHeader className="px-4 py-3 flex flex-row items-center justify-between border-b border-gray-100">
            <CardTitle className="text-lg font-semibold">Recent Transactions</CardTitle>
            <div className="flex items-center gap-2 bg-gray-50 rounded-md px-3 py-1.5">
              <Search className="h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search transactions..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 p-0 h-auto placeholder:text-gray-400"
              />
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-16rem)] scrollbar-hide">
              <div className="w-full">
                <div className="grid grid-cols-8 gap-4 p-3 text-sm font-medium text-gray-500 border-b border-gray-100">
                  <div>Transaction ID</div>
                  <div>Order ID</div>
                  <div>Amount</div>
                  <div>Status</div>
                  <div>Date & Time</div>
                  <div className="col-span-2">Order Summary</div>
                  <div>Details</div>
                </div>

                <div className="divide-y divide-gray-50">
                  {isLoading ? (
                    Array(5).fill(0).map((_, i) => (
                      <div key={i} className="grid grid-cols-8 gap-4 p-3 items-center">
                        {Array(8).fill(0).map((_, j) => (
                          <Skeleton key={j} className={`h-8 ${j === 5 ? 'col-span-2' : ''}`} />
                        ))}
                      </div>
                    ))
                  ) : (
                    filteredTransactions.map((transaction) => (
                      <motion.div
                        key={transaction.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="grid grid-cols-8 gap-4 p-3 items-center hover:bg-gray-50/50"
                      >
                        <div className="font-mono text-sm text-gray-600">
                          #{transaction.id}
                        </div>
                        <div className="text-gray-600">#{transaction.order_id}</div>
                        <div className="text-gray-900 font-medium">
                          {formatMoney(transaction.amount)}
                        </div>
                        <div>
                          <Badge className={getStatusColor(transaction.status)}>
                            {transaction.status}
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-500">
                          {formatDate(transaction.created_at)}
                        </div>
                        <div className="col-span-2 text-sm text-gray-600">
                          {getOrderSummary(transaction.order?.items)}
                        </div>
                        <div>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Badge variant="outline" className="cursor-help">
                                  View Details
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="space-y-2 p-1">
                                  <div className="text-sm font-medium border-b pb-1">Order Details</div>
                                  {transaction.order?.items?.map((item, idx) => (
                                    <div key={idx} className="space-y-1">
                                      <div className="text-sm font-medium">
                                        {item.quantity}x {item.drink.name}
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        Category: {item.drink.category}
                                        <br />
                                        Unit Price: {formatMoney(item.drink.price)}
                                        <br />
                                        Subtotal: {formatMoney(item.drink.price * item.quantity)}
                                      </div>
                                    </div>
                                  ))}
                                  <div className="text-sm font-medium pt-1 border-t">
                                    Total: {formatMoney(transaction.order.total)}
                                  </div>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}