import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import type { DashboardStats } from "@/types/dashboard";

interface Props {
  items?: Array<{
    id: number;
    name: string;
    currentStock: number;
    minRequired: number;
  }>;
}

export default function InventoryAlerts({ items }: Props) {
  if (!items?.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          Low Stock Alerts
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {items.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="p-4 rounded-lg bg-muted/50"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Current stock: {item.currentStock}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-destructive">
                    Min required: {item.minRequired}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
