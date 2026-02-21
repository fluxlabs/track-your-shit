// Track Your Shit - Broadcast Mode Indicator (SH-05)
// Overlay showing broadcast mode is active for a terminal tab
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { Radio } from 'lucide-react';

export function BroadcastIndicator() {
  return (
    <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5 px-2 py-1 rounded-md bg-status-error/90 text-white text-[10px] font-medium shadow-lg animate-pulse">
      <Radio className="h-3 w-3" />
      BROADCAST
    </div>
  );
}
