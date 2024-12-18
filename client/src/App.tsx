import { Switch, Route } from "wouter";
import { Home } from "@/pages/Home";
import { Inventory } from "@/pages/Inventory";
import { AIManagement } from "@/pages/AIManagement";
import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

function App() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/inventory" component={Inventory} />
        <Route path="/ai-management" component={AIManagement} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function NotFound() {
  return (
    <div className="w-full flex items-center justify-center py-12">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <h1 className="text-2xl font-bold text-gray-900">404 Page Not Found</h1>
          </div>

          <p className="mt-4 text-sm text-gray-600">
            The page you're looking for doesn't exist.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default App;
