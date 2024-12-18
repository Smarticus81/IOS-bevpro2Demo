import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Mic, Volume2 } from "lucide-react";
import { realtimeVoiceSynthesis } from "@/lib/voice-realtime";

export function Settings() {
  const { toast } = useToast();

  const testVoice = async () => {
    try {
      await realtimeVoiceSynthesis.speak("This is a test of the voice synthesis system.");
      toast({
        title: "Voice Test",
        description: "Voice synthesis test completed",
      });
    } catch (error) {
      toast({
        title: "Voice Test Failed",
        description: error.message,
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
            <CardTitle>Voice Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Voice Provider</Label>
                  <div className="text-sm text-muted-foreground">
                    Choose between Eleven Labs and Web Speech API
                  </div>
                </div>
                <Select defaultValue="elevenlabs">
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="elevenlabs">Eleven Labs</SelectItem>
                    <SelectItem value="webspeech">Web Speech API</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Use Voice Response</Label>
                  <div className="text-sm text-muted-foreground">
                    Enable or disable voice responses
                  </div>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="space-y-2">
                <Label>Voice Test</Label>
                <div className="flex gap-4">
                  <Button onClick={testVoice} className="gap-2">
                    <Volume2 className="h-4 w-4" />
                    Test Voice
                  </Button>
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="space-y-4">
                <h3 className="text-lg font-medium">API Configuration</h3>
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="eleven-labs-key">Eleven Labs API Key</Label>
                    <Input
                      id="eleven-labs-key"
                      type="password"
                      placeholder="Enter your Eleven Labs API key"
                    />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
