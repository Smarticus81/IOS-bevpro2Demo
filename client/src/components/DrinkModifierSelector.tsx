import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { Beaker, IceCream2, Percent } from "lucide-react";

interface Props {
  onModifierChange: (modifiers: {
    pourSize: 'single' | 'double' | 'triple' | 'shot',
    extras: string[]
  }) => void;
  defaultPourSize?: 'single' | 'double' | 'triple' | 'shot';
  isSpirit?: boolean;
}

export function DrinkModifierSelector({ onModifierChange, defaultPourSize = 'single', isSpirit = false }: Props) {
  const [pourSize, setPourSize] = useState<'single' | 'double' | 'triple' | 'shot'>(defaultPourSize);
  const [extras, setExtras] = useState<string[]>([]);

  const handlePourSizeChange = (value: 'single' | 'double' | 'triple' | 'shot') => {
    setPourSize(value);
    onModifierChange({ pourSize: value, extras });
  };

  const toggleExtra = (extra: string) => {
    const newExtras = extras.includes(extra)
      ? extras.filter(e => e !== extra)
      : [...extras, extra];
    setExtras(newExtras);
    onModifierChange({ pourSize, extras: newExtras });
  };

  return (
    <Card className="w-full bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl 
                    border-white/20 shadow-xl rounded-2xl overflow-hidden">
      <CardContent className="p-4 md:p-5">
        {isSpirit && (
          <div className="mb-5">
            <Label className="text-sm font-medium mb-3 block">Pour Size</Label>
            <RadioGroup
              defaultValue={pourSize}
              onValueChange={handlePourSizeChange}
              className="grid grid-cols-2 md:grid-cols-4 gap-3"
            >
              {['single', 'double', 'triple', 'shot'].map((size) => (
                <Label
                  key={size}
                  className="cursor-pointer"
                >
                  <RadioGroupItem
                    value={size}
                    id={size}
                    className="peer sr-only"
                  />
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl
                              border-2 transition-all duration-200
                              peer-checked:border-primary peer-checked:bg-primary/10
                              ${pourSize === size ? 'border-primary' : 'border-gray-200 dark:border-gray-700'}
                              hover:border-primary/50`}
                  >
                    <Beaker className={`h-4 w-4 ${pourSize === size ? 'text-primary' : 'text-gray-500'}`} />
                    <span className="capitalize font-medium">{size}</span>
                  </motion.div>
                </Label>
              ))}
            </RadioGroup>
          </div>
        )}

        <div>
          <Label className="text-sm font-medium mb-3 block">Extras</Label>
          <div className="flex flex-wrap gap-3">
            {[
              { label: 'Extra Ice', icon: IceCream2 },
              { label: 'Strong', icon: Percent },
            ].map(({ label, icon: Icon }) => (
              <motion.div
                key={label}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex-1 min-w-[120px]"
              >
                <Button
                  variant={extras.includes(label) ? "default" : "outline"}
                  size="lg"
                  onClick={() => toggleExtra(label)}
                  className="w-full gap-2 py-6"
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{label}</span>
                </Button>
              </motion.div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}