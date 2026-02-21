// Track Your Shit - Keyboard Shortcuts Help Dialog
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { SHORTCUTS } from '@/hooks/use-keyboard-shortcuts';

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const categories = ['Search', 'Navigation', 'Shell', 'General'] as const;

export function KeyboardShortcutsDialog({
  open,
  onOpenChange,
}: KeyboardShortcutsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            Quick actions to navigate and control the app.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {categories.map((category) => {
            const items = SHORTCUTS.filter((s) => s.category === category);
            if (items.length === 0) return null;
            return (
              <div key={category}>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  {category}
                </h3>
                <div className="space-y-1.5">
                  {items.map((shortcut) => (
                    <div
                      key={shortcut.keys}
                      className="flex items-center justify-between py-1"
                    >
                      <span className="text-sm text-foreground">
                        {shortcut.description}
                      </span>
                      <div className="flex items-center gap-1">
                        {shortcut.displayKeys().map((key, i) => (
                          <kbd
                            key={i}
                            className="bg-muted rounded px-1.5 py-0.5 text-xs font-mono border border-border/50 min-w-[22px] text-center"
                          >
                            {key}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
