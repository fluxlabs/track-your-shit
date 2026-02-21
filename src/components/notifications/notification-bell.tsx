// Track Your Shit - Notification Bell Component
// Bell icon with unread badge and popover panel
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { useState, useEffect, useCallback } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NotificationPanel } from './notification-panel';
import { useUnreadNotificationCount } from '@/lib/queries';
import { onNotificationNew } from '@/lib/tauri';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { data: unreadCount = 0 } = useUnreadNotificationCount();
  const queryClient = useQueryClient();

  // Real-time: invalidate queries when new notification arrives
  const invalidateOnNew = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.allNotifications() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.unreadCount() });
  }, [queryClient]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    void onNotificationNew(() => {
      if (!cancelled) invalidateOnNew();
    }).then((fn) => {
      if (cancelled) {
        fn();
      } else {
        unlisten = fn;
      }
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [invalidateOnNew]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative h-8 w-8 p-0"
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="p-0 w-auto" sideOffset={8}>
        <NotificationPanel onClose={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}
