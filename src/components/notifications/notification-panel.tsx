// Track Your Shit - Notification Panel Component
// Scrollable list of notifications with actions
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { NotificationItem } from './notification-item';
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useClearNotifications,
} from '@/lib/queries';
import { useNavigate } from 'react-router-dom';
import { BellOff, CheckCheck, Trash2 } from 'lucide-react';

interface NotificationPanelProps {
  onClose: () => void;
}

export function NotificationPanel({ onClose }: NotificationPanelProps) {
  const { data: notifications = [] } = useNotifications(50);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const clearAll = useClearNotifications();
  const navigate = useNavigate();

  const handleItemClick = (notification: (typeof notifications)[0]) => {
    if (!notification.read) {
      markRead.mutate(notification.id);
    }
    if (notification.link) {
      void navigate(notification.link);
      onClose();
    }
  };

  return (
    <div className="w-80">
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <h3 className="text-sm font-semibold">Notifications</h3>
      </div>

      <ScrollArea className="max-h-[360px]">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
            <BellOff className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm">No notifications</p>
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {notifications.map((n) => (
              <NotificationItem
                key={n.id}
                notification={n}
                onClick={() => handleItemClick(n)}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      {notifications.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs flex-1"
            onClick={() => markAllRead.mutate()}
          >
            <CheckCheck className="h-3 w-3 mr-1" />
            Mark all read
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs flex-1 text-destructive hover:text-destructive"
            onClick={() => clearAll.mutate()}
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Clear all
          </Button>
        </div>
      )}
    </div>
  );
}
