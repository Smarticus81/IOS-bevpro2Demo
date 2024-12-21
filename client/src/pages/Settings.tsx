import { useState } from "react";
import { NavBar } from "@/components/NavBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Palette, Key } from "lucide-react";


export function Settings() {

  const [uiSettings, setUiSettings] = useState({
    theme: "dark",
    animations: true,
    highContrast: false,
    compactMode: false,
  });

  const [apiSettings, setApiSettings] = useState({
    // stripeKey: "", //Removed Stripe Key
  });

  const handleSave = async () => {
    try {
      // Save non-sensitive settings
      localStorage.setItem('bevpro_settings', JSON.stringify({
        ui: uiSettings
      }));


      toast({
        title: "Settings saved",
        description: "Your preferences have been updated successfully.",
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <NavBar />

      <div className="container mx-auto p-4 lg:p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
          <p className="text-white/70">Customize your BevPro experience</p>
        </div>

        <Tabs defaultValue="ui" className="space-y-6">
          <TabsList className="bg-black/40 border border-white/10">
            <TabsTrigger value="ui" className="gap-2 text-white/70 data-[state=active]:bg-white/10 data-[state=active]:text-white">
              <Palette className="h-4 w-4" />
              UI
            </TabsTrigger>
            <TabsTrigger value="api" className="gap-2 text-white/70 data-[state=active]:bg-white/10 data-[state=active]:text-white">
              <Key className="h-4 w-4" />
              API
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ui">
            <Card className="bg-white/90 backdrop-blur-md border-white/20 shadow-xl">
              <CardHeader>
                <CardTitle>UI Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Animations</Label>
                    <div className="text-sm text-gray-600">Enable UI animations and transitions</div>
                  </div>
                  <Switch
                    checked={uiSettings.animations}
                    onCheckedChange={(checked) => setUiSettings(prev => ({ ...prev, animations: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>High Contrast</Label>
                    <div className="text-sm text-gray-600">Increase contrast for better visibility</div>
                  </div>
                  <Switch
                    checked={uiSettings.highContrast}
                    onCheckedChange={(checked) => setUiSettings(prev => ({ ...prev, highContrast: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Compact Mode</Label>
                    <div className="text-sm text-gray-600">Reduce spacing in the interface</div>
                  </div>
                  <Switch
                    checked={uiSettings.compactMode}
                    onCheckedChange={(checked) => setUiSettings(prev => ({ ...prev, compactMode: checked }))}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="api">
            <Card className="bg-white/90 backdrop-blur-md border-white/20 shadow-xl">
              <CardHeader>
                <CardTitle>API Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* Payment Settings */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Payment Settings</h3>
                  <div className="text-sm text-gray-600">
                    Payment processing is handled through our internal system
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="mt-8">
          <Button
            onClick={handleSave}
            className="w-full bg-gradient-to-b from-zinc-800 to-black text-white shadow-[0_4px_10px_rgba(0,0,0,0.3)] border border-white/10 backdrop-blur-sm hover:shadow-[0_6px_20px_rgba(0,0,0,0.4)] hover:from-zinc-700 hover:to-zinc-900 transition-all duration-300"
          >
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}