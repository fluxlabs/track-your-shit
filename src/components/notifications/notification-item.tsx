// Track Your Shit - Notification Item Component
// Single notification row with icon, title, message, and timestamp
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { cn } from '@/lib/utils';
import type { Notification } from '@/lib/tauri';
import {
  CheckCircle,
  XCircle,
  Flag,
  RefreshCw,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface NotificationItemProps {
  notification: Notification;
  onClick: () => void;
}

const typeIcons: Record<string, typeof CheckCircle> = {
  complete: CheckCircle,
  failed: XCircle,
  phase: Flag,
  sync: RefreshCw,
  error: AlertTriangle,
};

const typeColors: Record<string, string> = {
  complete: 'text-green-500',
  failed: 'text-red-500',
  phase: 'text-blue-500',
  sync: 'text-purple-500',
  error: 'text-amber-500',
};

export function NotificationItem({ notification, onClick }: NotificationItemProps) {
  const Icon = typeIcons[notification.notification_type] || Info;
  const iconColor = typeColors[notification.notification_type] || 'text-muted-foreground';

  const timeAgo = formatDistanceToNow(new Date(notification.created_at + 'Z'), {
    addSuffix: true,
  });

  return (
    <button
      className={cn(
        'flex items-start gap-3 w-full px-3 py-2.5 text-left hover:bg-accent/50 transition-colors',
        !notification.read && 'border-l-2 border-brand-blue bg-brand-blue/5',
      )}
      onClick={onClick}
    >
      <Icon className={cn('h-4 w-4 mt-0.5 flex-shrink-0', iconColor)} />
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            'text-sm truncate',
            notification.read ? 'text-muted-foreground' : 'text-foreground font-medium',
          )}
        >
          {notification.title}
        </p>
        {notification.message && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {notification.message}
          </p>
        )}
        <p className="text-[10px] text-muted-foreground/60 mt-1">{timeAgo}</p>
      </div>
    </button>
  );
}
