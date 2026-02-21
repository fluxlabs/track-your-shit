// Track Your Shit - Close Warning Hook
// Warns user before closing if active processes are running
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { useEffect, useState, useCallback } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { canSafelyClose, forceCloseAll, type ActiveProcessInfo } from "@/lib/tauri";

interface UseCloseWarningReturn {
  showWarning: boolean;
  processInfo: ActiveProcessInfo | null;
  handleCancel: () => void;
  handleForceClose: () => Promise<void>;
}

export function useCloseWarning(): UseCloseWarningReturn {
  const [showWarning, setShowWarning] = useState(false);
  const [processInfo, setProcessInfo] = useState<ActiveProcessInfo | null>(null);

  const handleCancel = useCallback(() => {
    setShowWarning(false);
    setProcessInfo(null);
  }, []);

  const handleForceClose = useCallback(async () => {
    try {
      await forceCloseAll();
      const window = getCurrentWindow();
      await window.destroy();
    } catch {
      // Force close is best-effort; window may already be closing
    }
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupListener = async () => {
      const window = getCurrentWindow();
      unlisten = await window.onCloseRequested(async (event) => {
        // Prevent default close behavior
        event.preventDefault();

        try {
          const info = await canSafelyClose();
          if (info.can_close) {
            // Safe to close, destroy the window
            await window.destroy();
          } else {
            // Show warning dialog
            setProcessInfo(info);
            setShowWarning(true);
          }
        } catch {
          // Allow close on error — can't determine process status
          await window.destroy();
        }
      });
    };

    void setupListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  return {
    showWarning,
    processInfo,
    handleCancel,
    handleForceClose,
  };
}
