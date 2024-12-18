import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Camera, Plus } from "lucide-react";

export function Inventory() {
  return (
    <div className="grid gap-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Inventory Management</h1>
        <div className="flex gap-2">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
          <Button variant="outline">
            <Camera className="h-4 w-4 mr-2" />
            Scan Item
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Current Inventory</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground">
            Inventory management features coming soon...
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
