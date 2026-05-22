import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import { supabaseNotificationsService } from '@/services/api-services';
import { NotificationItem } from '@/types';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

interface NotificationBellProps {
  compact?: boolean;
}

function formatRelativeDate(value: string) {
  const date = new Date(value);
  return date.toLocaleString('ar', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export function NotificationBell({ compact = false }: NotificationBellProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);

  const loadNotifications = useCallback(async () => {
    if (!user) return;

    try {
      setError('');
      const result = await supabaseNotificationsService.list({ page: 1, limit: 8 });
      setNotifications(result.data);
      setUnreadCount(result.unreadCount);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل الإشعارات');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    loadNotifications();

    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          loadNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadNotifications, user]);
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);


  const handleMarkAllAsRead = async () => {
    setMarkingAll(true);
    try {
      const newUnreadCount = await supabaseNotificationsService.markAllAsRead();
      setUnreadCount(newUnreadCount);
      setNotifications((current) => current.map((notification) => ({ ...notification, read: true })));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر تحديث الإشعارات');
    } finally {
      setMarkingAll(false);
    }
  };

  const handleNotificationClick = async (notification: NotificationItem) => {
    try {
      if (!notification.read) {
        const newUnreadCount = await supabaseNotificationsService.markAsRead(notification.id);
        setUnreadCount(newUnreadCount);
        setNotifications((current) =>
          current.map((item) => (item.id === notification.id ? { ...item, read: true } : item))
        );
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر تحديث حالة الإشعار');
    }

    setOpen(false);

    if (notification.workspace_id) {
      navigate(`/workspace/${notification.workspace_id}`);
    }
  };

  const unreadBadge = useMemo(() => {
    if (unreadCount <= 0) return null;
    return unreadCount > 99 ? '99+' : String(unreadCount);
  }, [unreadCount]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((value) => !value)}
        className={`relative inline-flex items-center justify-center rounded-xl border border-line/70 bg-surface-2/80 text-fg-2 transition hover:bg-surface-3/80 ${compact ? 'h-10 w-10' : 'h-11 w-11'}`}
        title="الإشعارات"
      >
        <Bell className="w-5 h-5" />
        {unreadBadge && (
          <span className="absolute -top-1 -left-1 min-w-5 h-5 px-1 rounded-full bg-red-500 text-fg-1 text-[10px] font-bold flex items-center justify-center">
            {unreadBadge}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 mt-3 w-[360px] max-w-[calc(100vw-2rem)] rounded-3xl border border-line/70 bg-surface-1/95 shadow-2xl shadow-black/40 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-4 border-b border-line">
            <div>
              <h3 className="font-semibold text-fg-1">الإشعارات</h3>
              <p className="text-xs text-fg-3 mt-1">{unreadCount} غير مقروء</p>
            </div>
            <button
              onClick={handleMarkAllAsRead}
              disabled={markingAll || unreadCount === 0}
              className="inline-flex items-center gap-2 rounded-xl border border-line-strong bg-surface-2/80 px-3 py-2 text-xs text-fg-2 hover:bg-surface-3/80 disabled:opacity-50"
            >
              {markingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCheck className="w-3.5 h-3.5" />}
              تعليم الكل كمقروء
            </button>
          </div>

          {error && (
            <div className="px-4 py-3 text-xs text-brick-soft border-b border-brick/30 bg-brick/10">
              {error}
            </div>
          )}

          <div className="max-h-[420px] overflow-auto">
            {loading ? (
              <div className="p-6 flex items-center justify-center text-fg-3 text-sm">
                <Loader2 className="w-4 h-4 animate-spin ml-2" />
                جاري تحميل الإشعارات...
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-6 text-center text-sm text-fg-4">لا توجد إشعارات حالياً.</div>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`w-full text-right px-4 py-4 border-b border-line transition hover:bg-surface-2/80 ${
                    notification.read ? 'bg-transparent' : 'bg-brass/8'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`mt-1 h-2.5 w-2.5 rounded-full shrink-0 ${notification.read ? 'bg-surface-4' : 'bg-brass-ring'}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3 mb-1">
                        <p className="text-sm font-medium text-fg-1 truncate">{notification.title}</p>
                        <span className="text-[11px] text-fg-4 shrink-0">{formatRelativeDate(notification.created_at)}</span>
                      </div>
                      <p className="text-xs leading-6 text-fg-2">{notification.message}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
