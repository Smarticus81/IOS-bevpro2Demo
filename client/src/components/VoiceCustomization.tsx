import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Mic,
  Plus,
  X,
  Volume2,
  Settings2,
  Languages,
  Brain,
  Waves,
  MessageSquare,
  Sliders,
  RefreshCw
} from 'lucide-react';
import type { VoiceSettings, VoiceCommandPreference } from '@/types/speech';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  settings: VoiceSettings;
  onSave: (settings: VoiceSettings) => void;
}

const AVAILABLE_LANGUAGES = [
  { code: 'en-US', name: 'English (US)' },
  { code: 'en-GB', name: 'English (UK)' },
  { code: 'es-ES', name: 'Spanish' },
  { code: 'fr-FR', name: 'French' },
];

const CONFIRMATION_MODES = [
  { value: 'always', label: 'Always Confirm' },
  { value: 'high-value', label: 'High-value Only' },
  { value: 'never', label: 'Never Confirm' },
];

export function VoiceCustomization({ isOpen, onClose, settings, onSave }: Props) {
  const [currentSettings, setCurrentSettings] = useState<VoiceSettings>(settings);
  const [activeTab, setActiveTab] = useState('general');

  const handleSettingChange = useCallback(<K extends keyof VoiceSettings>(
    key: K,
    value: VoiceSettings[K]
  ) => {
    setCurrentSettings(prev => ({
      ...prev,
      [key]: value
    }));
  }, []);

  const handleWakeWordChange = (value: string) => {
    handleSettingChange('wakeWord', value);
  };

  const handleVolumeChange = (value: number[]) => {
    handleSettingChange('volume', value[0]);
  };

  const handleSpeedChange = (value: number[]) => {
    handleSettingChange('speed', value[0]);
  };

  const handlePitchChange = (value: number[]) => {
    handleSettingChange('pitch', value[0]);
  };

  const toggleCommand = (index: number) => {
    setCurrentSettings(prev => ({
      ...prev,
      commandPreferences: prev.commandPreferences.map((pref, i) =>
        i === index ? { ...pref, enabled: !pref.enabled } : pref
      )
    }));
  };

  const addAlias = (commandIndex: number, alias: string) => {
    setCurrentSettings(prev => ({
      ...prev,
      commandPreferences: prev.commandPreferences.map((pref, i) =>
        i === commandIndex
          ? { ...pref, aliases: [...pref.aliases, alias] }
          : pref
      )
    }));
  };

  const removeAlias = (commandIndex: number, aliasIndex: number) => {
    setCurrentSettings(prev => ({
      ...prev,
      commandPreferences: prev.commandPreferences.map((pref, i) =>
        i === commandIndex
          ? {
              ...pref,
              aliases: pref.aliases.filter((_, j) => j !== aliasIndex)
            }
          : pref
      )
    }));
  };

  const handleSave = () => {
    onSave(currentSettings);
    onClose();
  };

  const resetToDefaults = () => {
    setCurrentSettings(settings);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Voice Command Settings</DialogTitle>
          <DialogDescription>
            Customize your voice interaction preferences
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-4 gap-4">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="commands">Commands</TabsTrigger>
            <TabsTrigger value="recognition">Recognition</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[500px] pr-4 mt-4">
            <TabsContent value="general" className="space-y-6">
              {/* Wake Word Section */}
              <div className="space-y-2">
                <Label htmlFor="wakeWord" className="flex items-center gap-2">
                  <Mic className="h-4 w-4" />
                  Wake Word
                </Label>
                <Input
                  id="wakeWord"
                  value={currentSettings.wakeWord}
                  onChange={e => handleWakeWordChange(e.target.value)}
                  placeholder="Hey Bar"
                />
              </div>

              {/* Voice Controls */}
              <div className="space-y-4">
                <Label className="flex items-center gap-2">
                  <Volume2 className="h-4 w-4" />
                  Voice Volume
                </Label>
                <Slider
                  value={[currentSettings.volume]}
                  onValueChange={handleVolumeChange}
                  max={100}
                  step={1}
                />

                <Label className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Speech Rate
                </Label>
                <Slider
                  value={[currentSettings.speed]}
                  onValueChange={handleSpeedChange}
                  min={0.5}
                  max={2}
                  step={0.1}
                />

                <Label className="flex items-center gap-2">
                  <Waves className="h-4 w-4" />
                  Voice Pitch
                </Label>
                <Slider
                  value={[currentSettings.pitch]}
                  onValueChange={handlePitchChange}
                  min={0.5}
                  max={2}
                  step={0.1}
                />
              </div>

              {/* Language Selection */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Languages className="h-4 w-4" />
                  Language
                </Label>
                <Select
                  value={currentSettings.language}
                  onValueChange={value => handleSettingChange('language', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_LANGUAGES.map(lang => (
                      <SelectItem key={lang.code} value={lang.code}>
                        {lang.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            <TabsContent value="commands" className="space-y-4">
              <Label>Command Preferences</Label>
              {currentSettings.commandPreferences.map((pref, index) => (
                <motion.div
                  key={pref.command}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="border rounded-lg p-4 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{pref.command}</span>
                      <Badge variant="secondary">{pref.action}</Badge>
                    </div>
                    <Switch
                      checked={pref.enabled}
                      onCheckedChange={() => toggleCommand(index)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Aliases</Label>
                    <div className="flex flex-wrap gap-2">
                      {pref.aliases.map((alias, aliasIndex) => (
                        <div
                          key={alias}
                          className="flex items-center gap-1 bg-secondary px-2 py-1 rounded-full text-sm"
                        >
                          {alias}
                          <button
                            onClick={() => removeAlias(index, aliasIndex)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => {
                          const alias = prompt('Enter new alias:');
                          if (alias) addAlias(index, alias);
                        }}
                        className="flex items-center gap-1 border border-dashed px-2 py-1 rounded-full text-sm text-muted-foreground hover:text-foreground"
                      >
                        <Plus className="h-3 w-3" />
                        Add Alias
                      </button>
                    </div>
                  </div>

                  {pref.requiresConfirmation !== undefined && (
                    <div className="flex items-center gap-2 mt-2">
                      <Switch
                        checked={pref.requiresConfirmation}
                        onCheckedChange={checked => {
                          setCurrentSettings(prev => ({
                            ...prev,
                            commandPreferences: prev.commandPreferences.map((p, i) =>
                              i === index ? { ...p, requiresConfirmation: checked } : p
                            )
                          }));
                        }}
                      />
                      <Label>Require Confirmation</Label>
                    </div>
                  )}
                </motion.div>
              ))}
            </TabsContent>

            <TabsContent value="recognition" className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label className="flex items-center gap-2">
                    <Brain className="h-4 w-4" />
                    Recognition Sensitivity
                  </Label>
                  <Slider
                    value={[currentSettings.recognitionSensitivity]}
                    onValueChange={value => handleSettingChange('recognitionSensitivity', value[0])}
                    max={100}
                    step={1}
                  />
                </div>

                <div>
                  <Label className="flex items-center gap-2">
                    <Waves className="h-4 w-4" />
                    Background Noise Threshold
                  </Label>
                  <Slider
                    value={[currentSettings.noiseThreshold]}
                    onValueChange={value => handleSettingChange('noiseThreshold', value[0])}
                    max={100}
                    step={1}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Settings2 className="h-4 w-4" />
                    Noise Cancellation
                  </Label>
                  <Switch
                    checked={currentSettings.useBackgroundNoiseCancellation}
                    onCheckedChange={checked => handleSettingChange('useBackgroundNoiseCancellation', checked)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Confirmation Mode
                </Label>
                <Select
                  value={currentSettings.confirmationMode}
                  onValueChange={value => handleSettingChange('confirmationMode', value as any)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select confirmation mode" />
                  </SelectTrigger>
                  <SelectContent>
                    {CONFIRMATION_MODES.map(mode => (
                      <SelectItem key={mode.value} value={mode.value}>
                        {mode.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            <TabsContent value="advanced" className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Brain className="h-4 w-4" />
                    Learning Mode
                  </Label>
                  <Switch
                    checked={currentSettings.learningMode}
                    onCheckedChange={checked => handleSettingChange('learningMode', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Emotional Responses
                  </Label>
                  <Switch
                    checked={currentSettings.emotionalResponses}
                    onCheckedChange={checked => handleSettingChange('emotionalResponses', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Sliders className="h-4 w-4" />
                    Autocorrect
                  </Label>
                  <Switch
                    checked={currentSettings.autocorrectEnabled}
                    onCheckedChange={checked => handleSettingChange('autocorrectEnabled', checked)}
                  />
                </div>
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <div className="flex justify-between gap-2 mt-4">
          <Button variant="outline" onClick={resetToDefaults} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Reset to Defaults
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save Changes</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}