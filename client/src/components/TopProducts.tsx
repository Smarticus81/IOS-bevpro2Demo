import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";
import type { DashboardStats } from "@/types/dashboard";
import { TrendingUp } from "lucide-react";

interface Props {
  products?: DashboardStats['popularDrinks'];
}

export default function TopProducts({ products }: Props) {
  if (!products?.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Top Products
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {products.map((product, index) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex items-center justify-between p-4 rounded-lg bg-muted/50"
            >
              <div>
                <p className="font-medium">{product.name}</p>
                <p className="text-sm text-muted-foreground">
                  {product.sales} units sold
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-primary">
                  #{index + 1}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
