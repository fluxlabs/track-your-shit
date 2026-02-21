// Track Your Shit - Theme Customization Settings Component
// Accent color, UI density, and font size configuration
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useTheme } from '@/hooks/use-theme';
import type { AccentColor, UiDensity, FontScale, FontFamily } from '@/hooks/use-theme';
import { Check } from 'lucide-react';

const ACCENT_OPTIONS: {
  value: AccentColor;
  label: string;
  colorClass: string;
  previewColor: string;
}[] = [
  {
    value: 'default',
    label: 'Default',
    colorClass: 'bg-[hsl(217,91%,60%)]',
    previewColor: 'hsl(217, 91%, 60%)',
  },
  {
    value: 'ocean',
    label: 'Ocean',
    colorClass: 'bg-[hsl(200,80%,50%)]',
    previewColor: 'hsl(200, 80%, 50%)',
  },
  {
    value: 'forest',
    label: 'Forest',
    colorClass: 'bg-[hsl(140,60%,40%)]',
    previewColor: 'hsl(140, 60%, 40%)',
  },
  {
    value: 'sunset',
    label: 'Sunset',
    colorClass: 'bg-[hsl(20,90%,55%)]',
    previewColor: 'hsl(20, 90%, 55%)',
  },
  {
    value: 'purple',
    label: 'Purple',
    colorClass: 'bg-[hsl(270,70%,55%)]',
    previewColor: 'hsl(270, 70%, 55%)',
  },
];

const DENSITY_OPTIONS: { value: UiDensity; label: string; description: string }[] = [
  { value: 'compact', label: 'Compact', description: 'Tighter spacing' },
  { value: 'normal', label: 'Normal', description: 'Default spacing' },
  { value: 'spacious', label: 'Spacious', description: 'More breathing room' },
];

const FONT_SCALE_OPTIONS: { value: FontScale; label: string; size: string }[] = [
  { value: 'sm', label: 'Small', size: '13px' },
  { value: 'md', label: 'Medium', size: '14px' },
  { value: 'lg', label: 'Large', size: '16px' },
];

const FONT_FAMILY_OPTIONS: { value: FontFamily; label: string; preview: string }[] = [
  { value: 'system', label: 'System', preview: 'Default' },
  { value: 'inter', label: 'Inter', preview: 'Sans-serif' },
  { value: 'jetbrains-mono', label: 'JetBrains', preview: 'Monospace' },
  { value: 'monospace', label: 'Mono', preview: 'Terminal' },
];

export function ThemeCustomization() {
  const { accentColor, setAccentColor, uiDensity, setUiDensity, fontScale, setFontScale, fontFamily, setFontFamily } =
    useTheme();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>Customize the look and feel of Track Your Shit</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Accent Color */}
        <div>
          <Label className="block text-sm font-medium mb-3">Accent Color</Label>
          <div className="flex items-center gap-3">
            {ACCENT_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setAccentColor(option.value)}
                className={cn(
                  'relative flex flex-col items-center gap-1.5 group',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-lg p-1.5',
                )}
                aria-label={`${option.label} accent color`}
                aria-pressed={accentColor === option.value}
              >
                <div
                  className={cn(
                    'w-8 h-8 rounded-full transition-all duration-200',
                    option.colorClass,
                    accentColor === option.value
                      ? 'ring-2 ring-offset-2 ring-offset-background ring-foreground scale-110'
                      : 'group-hover:scale-105',
                  )}
                >
                  {accentColor === option.value && (
                    <div className="flex items-center justify-center w-full h-full">
                      <Check className="h-4 w-4 text-white" />
                    </div>
                  )}
                </div>
                <span
                  className={cn(
                    'text-[10px]',
                    accentColor === option.value
                      ? 'text-foreground font-medium'
                      : 'text-muted-foreground',
                  )}
                >
                  {option.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* UI Density */}
        <div>
          <Label className="block text-sm font-medium mb-3">UI Density</Label>
          <div className="grid grid-cols-3 gap-2">
            {DENSITY_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setUiDensity(option.value)}
                className={cn(
                  'flex flex-col items-center justify-center rounded-lg border p-3 transition-all duration-200',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                  uiDensity === option.value
                    ? 'border-primary bg-primary/5 text-foreground'
                    : 'border-border hover:border-primary/30 hover:bg-accent/30 text-muted-foreground',
                )}
                aria-pressed={uiDensity === option.value}
              >
                <span className="text-sm font-medium">{option.label}</span>
                <span className="text-[10px] mt-0.5">{option.description}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Font Size */}
        <div>
          <Label className="block text-sm font-medium mb-3">Font Size</Label>
          <div className="grid grid-cols-3 gap-2">
            {FONT_SCALE_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setFontScale(option.value)}
                className={cn(
                  'flex flex-col items-center justify-center rounded-lg border p-3 transition-all duration-200',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                  fontScale === option.value
                    ? 'border-primary bg-primary/5 text-foreground'
                    : 'border-border hover:border-primary/30 hover:bg-accent/30 text-muted-foreground',
                )}
                aria-pressed={fontScale === option.value}
              >
                <span className="text-sm font-medium">{option.label}</span>
                <span className="text-[10px] mt-0.5">{option.size}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Font Family */}
        <div>
          <Label className="block text-sm font-medium mb-3">Font Family</Label>
          <div className="grid grid-cols-4 gap-2">
            {FONT_FAMILY_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setFontFamily(option.value)}
                className={cn(
                  'flex flex-col items-center justify-center rounded-lg border p-3 transition-all duration-200',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                  fontFamily === option.value
                    ? 'border-primary bg-primary/5 text-foreground'
                    : 'border-border hover:border-primary/30 hover:bg-accent/30 text-muted-foreground',
                )}
                aria-pressed={fontFamily === option.value}
              >
                <span className="text-sm font-medium">{option.label}</span>
                <span className="text-[10px] mt-0.5">{option.preview}</span>
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
