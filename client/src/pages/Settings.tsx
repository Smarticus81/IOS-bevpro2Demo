import { useState } from "react";
import { NavBar } from "@/components/NavBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { toast } from "@/hooks/use-toast";
import { Mic, Palette, Key, Brain, Volume2, CreditCard } from "lucide-react";
import { paymentService } from "@/lib/paymentService";

export function Settings() {
  const [voiceSettings, setVoiceSettings] = useState({
    voice: "alloy",
    speed: 1,
    pitch: 1,
    wakeWord: "hey bar",
    volume: 75,
    enableFeedback: true,
  });

  const [uiSettings, setUiSettings] = useState({
    theme: "dark",
    animations: true,
    highContrast: false,
    compactMode: false,
  });

  const [apiSettings, setApiSettings] = useState({
    openaiKey: "",
    anthropicKey: "",
    stripeKey: "",
  });

  const [aiSettings, setAiSettings] = useState({
    model: "gpt-4",
    temperature: 0.7,
    maxTokens: 150,
    systemPrompt: "You are a helpful beverage service assistant.",
  });

  const handleSave = async () => {
    try {
      // Save non-sensitive settings
      localStorage.setItem('bevpro_settings', JSON.stringify({
        voice: voiceSettings,
        ui: uiSettings,
        ai: aiSettings
      }));

      // Handle Stripe API key separately
      if (apiSettings.stripeKey) {
        if (!apiSettings.stripeKey.startsWith('sk_')) {
          toast({
            title: "Invalid Stripe API Key",
            description: "Please enter a valid Stripe secret key starting with 'sk_'",
            variant: "destructive"
          });
          return;
        }

        try {
          const isValid = await paymentService.validateStripeKey(apiSettings.stripeKey);
          if (!isValid) {
            throw new Error('Invalid Stripe API key');
          }
          
          toast({
            title: "Payment Configuration Updated",
            description: "Stripe API key has been validated and saved successfully.",
          });
        } catch (error) {
          toast({
            title: "Error Saving Stripe Key",
            description: "Failed to validate and save the Stripe API key. Please verify the key and try again.",
            variant: "destructive"
          });
          return;
        }
      }

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

        <Tabs defaultValue="voice" className="space-y-6">
          <TabsList className="bg-black/40 border border-white/10">
            <TabsTrigger value="voice" className="gap-2 text-white/70 data-[state=active]:bg-white/10 data-[state=active]:text-white">
              <Mic className="h-4 w-4" />
              Voice
            </TabsTrigger>
            <TabsTrigger value="ui" className="gap-2 text-white/70 data-[state=active]:bg-white/10 data-[state=active]:text-white">
              <Palette className="h-4 w-4" />
              UI
            </TabsTrigger>
            <TabsTrigger value="api" className="gap-2 text-white/70 data-[state=active]:bg-white/10 data-[state=active]:text-white">
              <Key className="h-4 w-4" />
              API
            </TabsTrigger>
            <TabsTrigger value="ai" className="gap-2 text-white/70 data-[state=active]:bg-white/10 data-[state=active]:text-white">
              <Brain className="h-4 w-4" />
              AI
            </TabsTrigger>
          </TabsList>

          <TabsContent value="voice">
            <Card className="bg-white/90 backdrop-blur-md border-white/20 shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Volume2 className="h-5 w-5" />
                  Voice Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label>Voice</Label>
                    <Select 
                      value={voiceSettings.voice}
                      onValueChange={(value) => setVoiceSettings(prev => ({ ...prev, voice: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="alloy">Alloy</SelectItem>
                        <SelectItem value="echo">Echo</SelectItem>
                        <SelectItem value="fable">Fable</SelectItem>
                        <SelectItem value="onyx">Onyx</SelectItem>
                        <SelectItem value="nova">Nova</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Voice Feedback</Label>
                      <div className="text-sm text-gray-600">Enable voice responses for manual orders</div>
                    </div>
                    <Switch
                      checked={voiceSettings.enableFeedback}
                      onCheckedChange={(checked) => setVoiceSettings(prev => ({ ...prev, enableFeedback: checked }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Wake Word</Label>
                    <Input 
                      value={voiceSettings.wakeWord}
                      onChange={(e) => setVoiceSettings(prev => ({ ...prev, wakeWord: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Volume ({voiceSettings.volume}%)</Label>
                    <Slider
                      value={[voiceSettings.volume]}
                      onValueChange={([value]) => setVoiceSettings(prev => ({ ...prev, volume: value }))}
                      max={100}
                      step={1}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

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
                {/* Voice AI Integration */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Voice AI Integration</h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>OpenAI API Key</Label>
                      <Input
                        type="password"
                        value={apiSettings.openaiKey}
                        onChange={(e) => setApiSettings(prev => ({ ...prev, openaiKey: e.target.value }))}
                        placeholder="sk-..."
                      />
                      <p className="text-xs text-gray-500">Required for voice synthesis and natural language processing</p>
                    </div>

                    <div className="space-y-2">
                      <Label>Anthropic API Key</Label>
                      <Input
                        type="password"
                        value={apiSettings.anthropicKey}
                        onChange={(e) => setApiSettings(prev => ({ ...prev, anthropicKey: e.target.value }))}
                        placeholder="sk-ant-..."
                      />
                      <p className="text-xs text-gray-500">Alternative AI provider for enhanced capabilities</p>
                    </div>
                  </div>
                </div>

                {/* Payment Integration */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Payment Integration</h3>
                  <div className="space-y-2">
                    <Label>Stripe Secret Key</Label>
                    <Input
                      type="password"
                      value={apiSettings.stripeKey}
                      onChange={(e) => setApiSettings(prev => ({ ...prev, stripeKey: e.target.value }))}
                      placeholder="sk_live_..."
                    />
                    <p className="text-xs text-gray-500">Required for processing payments and managing transactions</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ai">
            <Card className="bg-white/90 backdrop-blur-md border-white/20 shadow-xl">
              <CardHeader>
                <CardTitle>AI Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Model</Label>
                  <Select
                    value={aiSettings.model}
                    onValueChange={(value) => setAiSettings(prev => ({ ...prev, model: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gpt-4">GPT-4</SelectItem>
                      <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                      <SelectItem value="claude-3">Claude 3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Temperature ({aiSettings.temperature})</Label>
                  <Slider
                    value={[aiSettings.temperature * 100]}
                    onValueChange={([value]) => setAiSettings(prev => ({ ...prev, temperature: value / 100 }))}
                    max={100}
                    step={1}
                  />
                </div>

                <div className="space-y-2">
                  <Label>System Prompt</Label>
                  <Input
                    value={aiSettings.systemPrompt}
                    onChange={(e) => setAiSettings(prev => ({ ...prev, systemPrompt: e.target.value }))}
                  />
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
