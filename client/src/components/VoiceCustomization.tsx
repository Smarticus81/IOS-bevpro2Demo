import { useState } from 'react';
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
import { Mic, Plus, X, Volume2 } from 'lucide-react';
import type { VoiceSettings, VoiceCommandPreference } from '@/types/speech';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  settings: VoiceSettings;
  onSave: (settings: VoiceSettings) => void;
}

export function VoiceCustomization({ isOpen, onClose, settings, onSave }: Props) {
  const [currentSettings, setCurrentSettings] = useState<VoiceSettings>(settings);

  const handleWakeWordChange = (value: string) => {
    setCurrentSettings(prev => ({
      ...prev,
      wakeWord: value
    }));
  };

  const handleVolumeChange = (value: number[]) => {
    setCurrentSettings(prev => ({
      ...prev,
      volume: value[0]
    }));
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Voice Command Settings</DialogTitle>
          <DialogDescription>
            Customize your voice commands and preferences
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Wake Word Section */}
          <div className="space-y-2">
            <Label htmlFor="wakeWord">Wake Word</Label>
            <div className="flex items-center gap-2">
              <Mic className="h-4 w-4 text-muted-foreground" />
              <Input
                id="wakeWord"
                value={currentSettings.wakeWord}
                onChange={e => handleWakeWordChange(e.target.value)}
                placeholder="Hey Bar"
              />
            </div>
          </div>

          {/* Volume Control */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Volume2 className="h-4 w-4" />
              Sound Volume
            </Label>
            <Slider
              value={[currentSettings.volume]}
              onValueChange={handleVolumeChange}
              max={100}
              step={1}
            />
          </div>

          {/* Command Preferences */}
          <div className="space-y-4">
            <Label>Command Preferences</Label>
            {currentSettings.commandPreferences.map((pref, index) => (
              <motion.div
                key={pref.command}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="border rounded-lg p-4 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{pref.command}</span>
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
              </motion.div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
