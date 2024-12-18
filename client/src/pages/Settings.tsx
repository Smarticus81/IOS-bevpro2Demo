import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Mic, Volume2, AlertCircle, Wifi, CheckCircle2, XCircle } from "lucide-react";
import { realtimeVoiceSynthesis } from "@/lib/voice-realtime";
import { useState, useEffect } from "react";

export function Settings() {
  const { toast } = useToast();
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [provider, setProvider] = useState<string>("elevenlabs"); // Provider is now fixed to elevenlabs
  const [voiceStatus, setVoiceStatus] = useState<'connected' | 'error' | 'loading'>('loading');
  const [pitch, setPitch] = useState([1.0]);
  const [rate, setRate] = useState([1.0]);
  const [volume, setVolume] = useState([1.0]);
  const [apiKey, setApiKey] = useState("");
  const [isTestingVoice, setIsTestingVoice] = useState(false);

  useEffect(() => {
    // Load existing settings on mount
    const loadSettings = async () => {
      try {
        const response = await fetch('/api/settings/voice');
        if (response.ok) {
          const { config } = await response.json();
          setProvider(config.provider);
          setVoiceEnabled(config.voiceEnabled);
          setPitch([config.pitch]);
          setRate([config.rate]);
          setVolume([config.volume]);
        }
      } catch (error) {
        console.error('Failed to load voice settings:', error);
      }
    };

    loadSettings();
    checkVoiceStatus();
  }, []);

  const checkVoiceStatus = async () => {
    try {
      setVoiceStatus('loading');
      // Check if Web Speech API is available - This check is now redundant because webspeech is removed.
      if (provider === 'elevenlabs') {
        const response = await fetch('/api/config');
        if (response.ok) {
          setVoiceStatus('connected');
        } else {
          setVoiceStatus('error');
        }
      }
    } catch (error) {
      console.error('Voice status check failed:', error);
      setVoiceStatus('error');
    }
  };

  const testVoice = async () => {
    try {
      setIsTestingVoice(true);
      await realtimeVoiceSynthesis.speak(
        "This is a test of the voice synthesis system. If you can hear this message clearly, the voice system is working correctly."
      );
      toast({
        title: "Voice Test Successful",
        description: "Voice synthesis is working correctly",
        variant: "default",
      });
    } catch (error: any) {
      console.error('Voice test failed:', error);
      toast({
        title: "Voice Test Failed",
        description: error?.message || "Failed to test voice synthesis",
        variant: "destructive",
      });
    } finally {
      setIsTestingVoice(false);
    }
  };

  const saveSettings = async () => {
    try {
      // Save voice settings
      const settings = {
        provider,
        voiceEnabled,
        pitch: pitch[0],
        rate: rate[0],
        volume: volume[0],
        apiKey
      };
      
      const response = await fetch('/api/settings/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });

      if (!response.ok) throw new Error('Failed to save settings');

      toast({
        title: "Settings Saved",
        description: "Voice configuration has been updated successfully",
      });
    } catch (error: any) {
      toast({
        title: "Save Failed",
        description: error?.message || "Failed to save settings",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="grid gap-6">
      <h1 className="text-3xl font-bold">Settings</h1>

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Voice Settings
              {voiceStatus === 'connected' && <Badge variant="outline" className="bg-green-50"><CheckCircle2 className="h-3 w-3 text-green-500" /></Badge>}
              {voiceStatus === 'error' && <Badge variant="outline" className="bg-red-50"><XCircle className="h-3 w-3 text-red-500" /></Badge>}
              {voiceStatus === 'loading' && <Badge variant="outline" className="bg-yellow-50"><Wifi className="h-3 w-3 text-yellow-500" /></Badge>}
            </CardTitle>
            <CardDescription>
              Configure voice synthesis settings and test functionality
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Voice Provider</Label>
                  <div className="text-sm text-muted-foreground">
                    Using OpenAI Nova for high-quality voice synthesis
                  </div>
                </div>
                <Badge variant="secondary">OpenAI Nova</Badge>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Voice Response</Label>
                  <div className="text-sm text-muted-foreground">
                    Enable or disable voice responses
                  </div>
                </div>
                <Switch 
                  checked={voiceEnabled}
                  onCheckedChange={setVoiceEnabled}
                />
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <Label>Volume</Label>
                  <Slider
                    value={volume}
                    onValueChange={setVolume}
                    min={0.0}
                    max={1.0}
                    step={0.1}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Voice Test</Label>
                <div className="flex gap-4">
                  <Button 
                    onClick={testVoice} 
                    className="gap-2"
                    disabled={isTestingVoice || !voiceEnabled}
                  >
                    <Volume2 className="h-4 w-4" />
                    {isTestingVoice ? "Testing..." : "Test Voice"}
                  </Button>
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="space-y-4">
                <h3 className="text-lg font-medium">API Configuration</h3>
                <div className="grid gap-4">
                  {provider === 'elevenlabs' && (
                    <div className="grid gap-2">
                      <Label htmlFor="eleven-labs-key">Eleven Labs API Key</Label>
                      <Input
                        id="eleven-labs-key"
                        type="password"
                        placeholder="Enter your Eleven Labs API key"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                      />
                    </div>
                  )}

                  {voiceStatus === 'error' && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Unable to connect to voice service. Please check your API key and internet connection.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={saveSettings}>
                Save Settings
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Troubleshooting</CardTitle>
            <CardDescription>
              Voice system diagnostics and troubleshooting options
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Browser Compatibility</h4>
                  <p className="text-sm text-muted-foreground">
                    Using Eleven Labs for voice synthesis
                  </p>
                </div>
                <Badge variant={voiceStatus === 'connected' ? "default" : "destructive"}>
                  {voiceStatus === 'connected' ? "Compatible" : "Incompatible"}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Voice Service Status</h4>
                  <p className="text-sm text-muted-foreground">
                    Current status of the voice synthesis service
                  </p>
                </div>
                <Badge 
                  variant={
                    voiceStatus === 'connected' 
                      ? "default" 
                      : voiceStatus === 'loading' 
                        ? "secondary" 
                        : "destructive"
                  }
                >
                  {voiceStatus === 'connected' ? "Connected" : voiceStatus === 'loading' ? "Checking" : "Error"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}