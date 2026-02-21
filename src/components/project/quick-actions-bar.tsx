// Track Your Shit - Quick Actions Bar (OV-02)
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { RefreshCw, SquareTerminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface QuickActionsBarProps {
  onOpenShell: () => void;
  onSyncGsd?: () => void;
  isSyncingGsd?: boolean;
  hasPlanning?: boolean;
}

export function QuickActionsBar({
  onOpenShell,
  onSyncGsd,
  isSyncingGsd = false,
  hasPlanning = false,
}: QuickActionsBarProps) {
  return (
    <div className="flex items-center gap-2 pb-4">
      {hasPlanning && onSyncGsd && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={onSyncGsd}
              disabled={isSyncingGsd}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isSyncingGsd ? 'animate-spin' : ''}`} />
              Sync GSD
            </Button>
          </TooltipTrigger>
          <TooltipContent>Re-sync .planning/ files into the database</TooltipContent>
        </Tooltip>
      )}

      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline" size="sm" onClick={onOpenShell}>
            <SquareTerminal className="h-4 w-4 mr-2" />
            Shell
          </Button>
        </TooltipTrigger>
        <TooltipContent>Open interactive shell</TooltipContent>
      </Tooltip>
    </div>
  );
}
